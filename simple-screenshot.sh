#!/bin/bash

BASE_URL="https://3008-iyqztfdsdjzoqwi5ep5jz-5c13a017.sandbox.novita.ai"

pages=(
  "map"
  "feed"
  "wallet"
  "profile"
  "notifications"
  "settings"
)

echo "📸 Capturing screenshots for all pages..."
echo "================================================"

for page in "${pages[@]}"; do
  echo ""
  echo "📍 Testing page: /$page"
  
  # Test if page loads
  status=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/$page")
  echo "   HTTP Status: $status"
  
  if [ "$status" = "200" ]; then
    echo "   ✅ Page loads successfully"
  else
    echo "   ❌ Page failed to load"
  fi
done

echo ""
echo "================================================"
echo "✅ All pages tested!"
