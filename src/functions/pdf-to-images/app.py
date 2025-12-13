import os
import boto3
import json
import pypdfium2 as pdfium
import logging

# Configure logging
logger = logging.getLogger()
logger.setLevel(logging.INFO)

s3 = boto3.client('s3')
events_client = boto3.client('events')

def handler(event, context):
    logger.info(f"Received event: {json.dumps(event)}")

    try:
        # Parse EventBridge event
        detail = event.get("detail", {})
        job_id = detail.get("jobId")

        if not job_id:
            # Fallback for S3 event (if needed for debugging/legacy)
            if "Records" in event:
                job_id = "unknown_job_from_s3_event"
                # This path is likely not used in the new flow but good for safety
                logger.warning("Received S3 event, not EventBridge JobCreated")
                return
            else:
                raise ValueError("jobId not found in event detail")

        # Get environment variables
        pdf_bucket = os.environ.get("S3_BUCKET_PDFS")
        event_bus_name = os.environ.get("EVENT_BUS_NAME")

        if not pdf_bucket:
            raise ValueError("S3_BUCKET_PDFS environment variable not set")

        # S3 Key for input PDF
        input_key = f"{job_id}/original.pdf"
        local_pdf = f"/tmp/{job_id}_original.pdf"

        logger.info(f"Downloading PDF from {pdf_bucket}/{input_key}")

        # Download PDF from S3
        try:
            s3.download_file(pdf_bucket, input_key, local_pdf)
        except Exception as e:
            logger.error(f"Failed to download PDF: {str(e)}")
            raise

        # Process PDF
        logger.info("Converting PDF to images...")
        pdf = pdfium.PdfDocument(local_pdf)
        page_count = len(pdf)

        logger.info(f"PDF has {page_count} pages")

        output_prefix = f"{job_id}_pages"
        output_keys = []

        for i in range(page_count):
            page = pdf[i]
            # Render page to bitmap (scale=2 for better quality/OCR if needed)
            bitmap = page.render(scale=2)
            img = bitmap.to_pil()

            # Save locally
            local_img = f"/tmp/{job_id}_page_{i+1}.png"
            img.save(local_img)

            # Upload to S3
            output_key = f"{output_prefix}/page_{i+1}.png"
            s3.upload_file(local_img, pdf_bucket, output_key)
            output_keys.append(output_key)

            # Clean up local image
            if os.path.exists(local_img):
                os.remove(local_img)

        logger.info(f"Successfully uploaded {len(output_keys)} images to {output_prefix}/")

        # Publish ImagesGenerated event
        if event_bus_name:
            logger.info(f"Publishing ImagesGenerated event to {event_bus_name}")
            event_detail = {
                "jobId": job_id,
                "pageCount": page_count,
                "imagePrefix": output_prefix
            }

            events_client.put_events(
                Entries=[
                    {
                        'Source': 'pdf-lecture-service',
                        'DetailType': 'ImagesGenerated',
                        'Detail': json.dumps(event_detail),
                        'EventBusName': event_bus_name
                    }
                ]
            )
        else:
            logger.warning("EVENT_BUS_NAME not set, skipping event publication")

        # Clean up local PDF
        if os.path.exists(local_pdf):
            os.remove(local_pdf)

        return {
            "jobId": job_id,
            "pages": page_count,
            "status": "success"
        }

    except Exception as e:
        logger.error(f"Error processing job {job_id if 'job_id' in locals() else 'unknown'}: {str(e)}")
        raise e
