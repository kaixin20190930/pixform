export const title = "Image to Image AI — Free Image to Image Generator";
export const description = "Turn any photo into a new image with Pixform's free AI image to image generator. Upload, pick a style, download in seconds. No signup, no watermark.";
export const styles = [
  { id: "watercolor", name: "Watercolor", mark: "◌", color: "#ead7cd", detail: "Soft washes. A lighter touch.", prompt: "delicate watercolor painting, translucent pigment washes, textured watercolor paper" },
  { id: "cyberpunk", name: "Cyberpunk", mark: "▧", color: "#d6d5f0", detail: "Neon light. After-dark energy.", prompt: "cinematic cyberpunk illustration, neon lighting, futuristic atmosphere" },
  { id: "anime", name: "Anime", mark: "✧", color: "#dfebcd", detail: "Expressive lines. A new character.", prompt: "hand drawn anime illustration, expressive clean linework, rich cel shading" },
  { id: "oil-painting", name: "Oil Paint", mark: "◒", color: "#ecdab4", detail: "Rich texture. Painterly depth.", prompt: "fine art oil painting, textured brushstrokes, rich colors, painterly lighting" },
  { id: "sketch", name: "Sketch", mark: "〰", color: "#e2dfd7", detail: "Simple lines. Beautiful details.", prompt: "graphite pencil sketch on paper, delicate crosshatching, detailed linework" },
  { id: "pixel", name: "Pixel", mark: "▦", color: "#d0e2dd", detail: "Small squares. Big personality.", prompt: "pixel art illustration, limited color palette, crisp pixel edges, retro game aesthetic" },
] as const;
export const faqs = [
  ["What is image to image AI?", "Image to image AI creates a new image using an existing photo as its starting point. It can reinterpret the colors, textures and artistic style while keeping a connection to your original composition."],
  ["Is this image to image generator free?", "Pixform is designed for free, limited use. The launch allowance is up to 10 generation attempts per IP address per hour, subject to availability. There is no paid subscription in this first release."],
  ["Do I need to sign up to use it?", "No account is required. Choose a photo from your device and select a style to get started when generation is available."],
  ["What image formats are supported?", "You can select JPG, PNG or WEBP images up to 10 MB. Use a clear image for the best starting point. Animated GIFs and videos are not supported by this tool."],
  ["Can I use the generated images commercially?", "Commercial use depends on the rights to your original image, the selected model’s license and the rights of anyone depicted. AI output is not guaranteed to be unique or free of third-party rights. Check these before publishing commercially."],
  ["Is there a watermark on the output?", "Pixform does not add a watermark. The model may still generate unwanted marks or text as part of an image; inspect your result before using it."],
] as const;
