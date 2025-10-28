#!/bin/bash

# Manual Test Script for Perkie Print Headshot Endpoint
# Quick single-image test without Python dependencies

set -e

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Perkie Print Headshot - Manual Test${NC}"
echo -e "${BLUE}========================================${NC}\n"

# Configuration
API_URL="http://localhost:8000/api/v2/headshot"
OUTPUT_DIR="test_output/manual"

# Check if image path provided
if [ "$#" -eq 0 ]; then
    echo -e "${RED}❌ No image provided${NC}"
    echo -e "${YELLOW}Usage: ./test-headshot-manual.sh <path-to-pet-image.jpg>${NC}"
    echo -e "${YELLOW}Example: ./test-headshot-manual.sh test_images/golden_retriever.jpg${NC}"
    exit 1
fi

IMAGE_PATH="$1"

# Check if image exists
if [ ! -f "$IMAGE_PATH" ]; then
    echo -e "${RED}❌ Image not found: $IMAGE_PATH${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Found image: $IMAGE_PATH${NC}"

# Check if server is running
echo -e "\n${BLUE}ℹ️  Checking if API server is running...${NC}"
if curl -s -f http://localhost:8000/health > /dev/null 2>&1; then
    echo -e "${GREEN}✅ API server is running${NC}"
else
    echo -e "${RED}❌ API server is not running${NC}"
    echo -e "${YELLOW}ℹ️  Please start the server first:${NC}"
    echo -e "${YELLOW}   cd backend/inspirenet-api${NC}"
    echo -e "${YELLOW}   python src/main.py${NC}"
    exit 1
fi

# Create output directory
mkdir -p "$OUTPUT_DIR"

# Get filename without path and extension
FILENAME=$(basename "$IMAGE_PATH")
BASENAME="${FILENAME%.*}"
OUTPUT_PATH="$OUTPUT_DIR/${BASENAME}_headshot.png"

# Test the endpoint
echo -e "\n${BLUE}ℹ️  Testing headshot endpoint...${NC}"
echo -e "${BLUE}   Input:  $IMAGE_PATH${NC}"
echo -e "${BLUE}   Output: $OUTPUT_PATH${NC}\n"

# Measure time and send request
START_TIME=$(date +%s)

if curl -X POST "$API_URL" \
  -F "file=@$IMAGE_PATH" \
  -o "$OUTPUT_PATH" \
  -w "\nHTTP Status: %{http_code}\nTotal Time: %{time_total}s\n" \
  --max-time 120 \
  --silent --show-error; then

    END_TIME=$(date +%s)
    ELAPSED=$((END_TIME - START_TIME))

    echo -e "\n${GREEN}✅ Request completed in ${ELAPSED}s${NC}"

    # Check if output file exists and has content
    if [ -f "$OUTPUT_PATH" ] && [ -s "$OUTPUT_PATH" ]; then
        FILE_SIZE=$(ls -lh "$OUTPUT_PATH" | awk '{print $5}')
        echo -e "${GREEN}✅ Output saved: $OUTPUT_PATH (${FILE_SIZE})${NC}"

        # Check if it's a valid PNG using file command
        if command -v file &> /dev/null; then
            FILE_TYPE=$(file "$OUTPUT_PATH" | grep -o "PNG image data")
            if [ -n "$FILE_TYPE" ]; then
                echo -e "${GREEN}✅ Valid PNG image${NC}"

                # Get image dimensions if identify command available (ImageMagick)
                if command -v identify &> /dev/null; then
                    DIMENSIONS=$(identify -format "%wx%h" "$OUTPUT_PATH" 2>/dev/null)
                    if [ -n "$DIMENSIONS" ]; then
                        echo -e "${GREEN}✅ Dimensions: $DIMENSIONS${NC}"

                        # Check aspect ratio
                        WIDTH=$(echo $DIMENSIONS | cut -d'x' -f1)
                        HEIGHT=$(echo $DIMENSIONS | cut -d'x' -f2)
                        RATIO=$(echo "scale=3; $WIDTH / $HEIGHT" | bc)
                        TARGET_RATIO="0.800"  # 4/5 = 0.8

                        echo -e "${BLUE}ℹ️  Aspect ratio: $RATIO (target: $TARGET_RATIO for 4:5 portrait)${NC}"
                    fi
                fi
            else
                echo -e "${YELLOW}⚠️  Output file may not be a valid PNG${NC}"
            fi
        fi

        echo -e "\n${GREEN}========================================${NC}"
        echo -e "${GREEN}✨ Test completed successfully!${NC}"
        echo -e "${GREEN}========================================${NC}"
        echo -e "\n${BLUE}Next steps:${NC}"
        echo -e "${BLUE}1. Open the output image to verify quality:${NC}"
        echo -e "${YELLOW}   $OUTPUT_PATH${NC}"
        echo -e "${BLUE}2. Check for:${NC}"
        echo -e "   - Tight headshot crop (not full body)"
        echo -e "   - 4:5 portrait aspect ratio"
        echo -e "   - Head in top third of frame"
        echo -e "   - Professional B&W quality"
        echo -e "   - Transparent background"
        echo -e "   - Soft neck fade at bottom"
        echo -e "\n${BLUE}3. Run full test suite:${NC}"
        echo -e "${YELLOW}   python test_headshot_local.py${NC}"

    else
        echo -e "${RED}❌ Output file is empty or missing${NC}"
        exit 1
    fi

else
    echo -e "\n${RED}❌ Request failed${NC}"
    echo -e "${YELLOW}Check server logs for errors${NC}"
    exit 1
fi
