from PIL import Image
import sys

def diff(img1_path, img2_path):
    img1 = Image.open(img1_path).convert('RGB')
    img2 = Image.open(img2_path).convert('RGB')

    if img1.size != img2.size:
        print(f"Sizes differ: {img1.size} vs {img2.size}")
        return

    diff_count = 0
    total_pixels = img1.size[0] * img1.size[1]

    # Check a sample or all
    for x in range(img1.size[0]):
        for y in range(img1.size[1]):
            p1 = img1.getpixel((x,y))
            p2 = img2.getpixel((x,y))

            # small tolerance for anti-aliasing differences, if any
            if abs(p1[0]-p2[0]) > 5 or abs(p1[1]-p2[1]) > 5 or abs(p1[2]-p2[2]) > 5:
                diff_count += 1

    print(f"Different pixels: {diff_count} / {total_pixels} ({(diff_count/total_pixels)*100:.2f}%)")

diff('./verification/baseline_1_settled.png', '/tmp/after_1.png')
