#!/bin/bash
set -e

echo "Building pypdfium2 + Pillow Layer..."

# Create directory for layer
mkdir -p layers
rm -f layers/pdf_layer.zip

# Create a temporary directory for building
mkdir -p temp_layer/python

# Run Docker to install dependencies compatible with Lambda Python 3.12
docker run --rm -v $(pwd)/temp_layer:/var/task public.ecr.aws/sam/build-python3.12:latest \
    pip install pypdfium2 Pillow -t /var/task/python

# Zip the layer
cd temp_layer
zip -r ../layers/pdf_layer.zip python > /dev/null
cd ..

# Cleanup
rm -rf temp_layer

echo "Layer created at layers/pdf_layer.zip"
