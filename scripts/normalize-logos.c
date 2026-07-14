#include <CoreFoundation/CoreFoundation.h>
#include <CoreGraphics/CoreGraphics.h>
#include <ImageIO/ImageIO.h>
#include <math.h>
#include <stdio.h>
#include <stdlib.h>

static CFURLRef file_url(const char *path, Boolean is_directory) {
  CFStringRef string = CFStringCreateWithCString(
    kCFAllocatorDefault,
    path,
    kCFStringEncodingUTF8
  );
  CFURLRef url = CFURLCreateWithFileSystemPath(
    kCFAllocatorDefault,
    string,
    kCFURLPOSIXPathStyle,
    is_directory
  );
  CFRelease(string);
  return url;
}

int main(int argc, char **argv) {
  if (argc != 3) {
    fprintf(stderr, "Usage: normalize-logos <input-directory> <output-directory>\n");
    return 1;
  }

  char command[4096];
  snprintf(command, sizeof(command), "mkdir -p '%s'", argv[2]);
  if (system(command) != 0) return 2;

  const size_t canvas_width = 3600;
  const size_t canvas_height = 340;
  const CGFloat target_height = 220.0;
  const CGFloat maximum_width = 3400.0;
  const unsigned char alpha_threshold = 8;
  CGColorSpaceRef color_space = CGColorSpaceCreateDeviceRGB();

  for (int index = 1; index <= 5; index++) {
    char source_path[4096];
    char destination_path[4096];
    snprintf(source_path, sizeof(source_path), "%s/%d.png", argv[1], index);
    snprintf(destination_path, sizeof(destination_path), "%s/%d.png", argv[2], index);

    CFURLRef source_url = file_url(source_path, false);
    CGImageSourceRef source = CGImageSourceCreateWithURL(source_url, NULL);
    CGImageRef image = source ? CGImageSourceCreateImageAtIndex(source, 0, NULL) : NULL;
    if (!image) {
      fprintf(stderr, "Could not read %s\n", source_path);
      return 3;
    }

    size_t width = CGImageGetWidth(image);
    size_t height = CGImageGetHeight(image);
    size_t bytes_per_row = width * 4;
    unsigned char *pixels = calloc(height, bytes_per_row);
    CGContextRef scan = CGBitmapContextCreate(
      pixels,
      width,
      height,
      8,
      bytes_per_row,
      color_space,
      kCGImageAlphaPremultipliedLast | kCGBitmapByteOrder32Big
    );
    CGContextDrawImage(scan, CGRectMake(0, 0, width, height), image);

    size_t minimum_x = width;
    size_t minimum_y = height;
    size_t maximum_x = 0;
    size_t maximum_y = 0;
    Boolean found = false;
    for (size_t y = 0; y < height; y++) {
      size_t row = y * bytes_per_row;
      for (size_t x = 0; x < width; x++) {
        if (pixels[row + x * 4 + 3] <= alpha_threshold) continue;
        minimum_x = x < minimum_x ? x : minimum_x;
        minimum_y = y < minimum_y ? y : minimum_y;
        maximum_x = x > maximum_x ? x : maximum_x;
        maximum_y = y > maximum_y ? y : maximum_y;
        found = true;
      }
    }
    if (!found) {
      fprintf(stderr, "No visible pixels found in %s\n", source_path);
      return 4;
    }

    CGFloat content_width = (CGFloat)(maximum_x - minimum_x + 1);
    CGFloat content_height = (CGFloat)(maximum_y - minimum_y + 1);
    CGFloat scale = fmin(target_height / content_height, maximum_width / content_width);
    CGFloat draw_x = ((CGFloat)canvas_width - content_width * scale) / 2.0 - minimum_x * scale;
    CGFloat draw_y = ((CGFloat)canvas_height - content_height * scale) / 2.0 - minimum_y * scale;

    size_t output_row = canvas_width * 4;
    unsigned char *output_pixels = calloc(canvas_height, output_row);
    CGContextRef output = CGBitmapContextCreate(
      output_pixels,
      canvas_width,
      canvas_height,
      8,
      output_row,
      color_space,
      kCGImageAlphaPremultipliedLast | kCGBitmapByteOrder32Big
    );
    CGContextSetInterpolationQuality(output, kCGInterpolationHigh);
    CGContextDrawImage(
      output,
      CGRectMake(draw_x, draw_y, width * scale, height * scale),
      image
    );

    CGImageRef result = CGBitmapContextCreateImage(output);
    CFURLRef destination_url = file_url(destination_path, false);
    CGImageDestinationRef destination = CGImageDestinationCreateWithURL(
      destination_url,
      CFSTR("public.png"),
      1,
      NULL
    );
    CGImageDestinationAddImage(destination, result, NULL);
    if (!CGImageDestinationFinalize(destination)) {
      fprintf(stderr, "Could not write %s\n", destination_path);
      return 5;
    }

    printf(
      "%d.png: %.0fx%.0f -> %.0fx%.0f\n",
      index,
      content_width,
      content_height,
      content_width * scale,
      content_height * scale
    );

    CFRelease(destination);
    CFRelease(destination_url);
    CGImageRelease(result);
    CGContextRelease(output);
    free(output_pixels);
    CGContextRelease(scan);
    free(pixels);
    CGImageRelease(image);
    CFRelease(source);
    CFRelease(source_url);
  }

  CGColorSpaceRelease(color_space);
  return 0;
}
