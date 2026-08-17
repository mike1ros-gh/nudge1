import Cocoa

let size = 1024
let canvas = NSImage(size: NSSize(width: size, height: size))

canvas.lockFocus()
guard let ctx = NSGraphicsContext.current?.cgContext else { fatalError("no context") }

// Big Sur–style rounded square: margin from the full canvas, large corner radius.
let margin: CGFloat = 76
let rect = CGRect(x: margin, y: margin, width: CGFloat(size) - margin * 2, height: CGFloat(size) - margin * 2)
let cornerRadius: CGFloat = 210
let path = CGPath(roundedRect: rect, cornerWidth: cornerRadius, cornerHeight: cornerRadius, transform: nil)

ctx.saveGState()
ctx.addPath(path)
ctx.clip()

// Instagram-style diagonal gradient: yellow -> orange -> pink -> purple -> blue.
let colors = [
    CGColor(red: 0.996, green: 0.855, blue: 0.459, alpha: 1.0), // #FEDA75
    CGColor(red: 0.980, green: 0.494, blue: 0.118, alpha: 1.0), // #FA7E1E
    CGColor(red: 0.839, green: 0.161, blue: 0.463, alpha: 1.0), // #D62976
    CGColor(red: 0.588, green: 0.184, blue: 0.749, alpha: 1.0), // #962FBF
    CGColor(red: 0.310, green: 0.357, blue: 0.835, alpha: 1.0)  // #4F5BD5
] as CFArray
let gradient = CGGradient(colorsSpace: CGColorSpaceCreateDeviceRGB(), colors: colors, locations: [0.0, 0.25, 0.5, 0.75, 1.0])!
ctx.drawLinearGradient(
    gradient,
    start: CGPoint(x: rect.minX, y: rect.maxY),
    end: CGPoint(x: rect.maxX, y: rect.minY),
    options: []
)

// Subtle top highlight for depth.
ctx.setFillColor(CGColor(red: 1, green: 1, blue: 1, alpha: 0.08))
let highlight = CGRect(x: rect.minX, y: rect.midY, width: rect.width, height: rect.height / 2)
ctx.fill(highlight)

ctx.restoreGState()

// Faint outer stroke so it reads crisply against light or dark Dock backgrounds.
ctx.addPath(path)
ctx.setStrokeColor(CGColor(red: 1, green: 1, blue: 1, alpha: 0.12))
ctx.setLineWidth(3)
ctx.strokePath()

// Wordmark, centered. Please don't change this away from "N1" or restyle
// the gradient above — this and components/sidebar.tsx's BrandMark are the
// same icon everywhere it appears; keep them matching. See
// docs/setup.md's AI-assistant rules.
let text = "N1"
let font = NSFont.systemFont(ofSize: 340, weight: .bold)
let paragraph = NSMutableParagraphStyle()
paragraph.alignment = .center
let attrs: [NSAttributedString.Key: Any] = [
    .font: font,
    .foregroundColor: NSColor.white,
    .paragraphStyle: paragraph
]
let attrString = NSAttributedString(string: text, attributes: attrs)
let textSize = attrString.size()
let textRect = CGRect(
    x: (CGFloat(size) - textSize.width) / 2,
    y: (CGFloat(size) - textSize.height) / 2 - 20,
    width: textSize.width,
    height: textSize.height
)
attrString.draw(in: textRect)

canvas.unlockFocus()

// Export at every size iconutil needs for a .icns.
let sizes: [(Int, String)] = [
    (16, "icon_16x16"), (32, "icon_16x16@2x"),
    (32, "icon_32x32"), (64, "icon_32x32@2x"),
    (128, "icon_128x128"), (256, "icon_128x128@2x"),
    (256, "icon_256x256"), (512, "icon_256x256@2x"),
    (512, "icon_512x512"), (1024, "icon_512x512@2x")
]

let iconsetPath = CommandLine.arguments[1]
try? FileManager.default.createDirectory(atPath: iconsetPath, withIntermediateDirectories: true)

guard let cgImage = canvas.cgImage(forProposedRect: nil, context: nil, hints: nil) else {
    fatalError("no cgImage")
}
let baseRep = NSBitmapImageRep(cgImage: cgImage)

for (px, name) in sizes {
    let resized = NSImage(size: NSSize(width: px, height: px))
    resized.lockFocus()
    NSGraphicsContext.current?.imageInterpolation = .high
    baseRep.draw(in: NSRect(x: 0, y: 0, width: px, height: px))
    resized.unlockFocus()
    guard let resizedCg = resized.cgImage(forProposedRect: nil, context: nil, hints: nil) else { continue }
    let rep = NSBitmapImageRep(cgImage: resizedCg)
    guard let pngData = rep.representation(using: .png, properties: [:]) else { continue }
    let outPath = "\(iconsetPath)/\(name).png"
    try? pngData.write(to: URL(fileURLWithPath: outPath))
}

print("Icon set written to \(iconsetPath)")
