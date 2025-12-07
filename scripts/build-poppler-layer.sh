#!/bin/bash
# Build Poppler Lambda Layer for Amazon Linux 2

set -e

echo "Building Poppler Lambda Layer..."

# Create layer directory structure
mkdir -p layer/bin

# Use Docker to build poppler-utils for Amazon Linux 2
docker run --rm -v $(pwd)/layer:/layer amazonlinux:2 bash -c "
  yum install -y poppler-utils
  cp /usr/bin/pdftoppm /layer/bin/
  cp /usr/bin/pdfinfo /layer/bin/
  cp /usr/bin/pdftotext /layer/bin/
  
  # Copy required shared libraries
  mkdir -p /layer/lib
  ldd /usr/bin/pdftoppm | grep '=>' | awk '{print \$3}' | xargs -I {} cp {} /layer/lib/ || true
"

# Create layer zip
cd layer
zip -r ../poppler-layer.zip .
cd ..

echo "Poppler layer built: poppler-layer.zip"
echo "Upload this to AWS Lambda Layers"
