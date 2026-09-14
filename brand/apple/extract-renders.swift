// Writes the pre-rendered app icon images from an Assets.car that actool
// compiled from an Icon Composer document. Apple exposes no public API or
// command for this, so the private CoreUI catalog is read through the
// Objective-C runtime. Usage: extract-renders <Assets.car> <output directory>
import Foundation
import ImageIO
import UniformTypeIdentifiers

guard CommandLine.arguments.count == 3,
      dlopen("/System/Library/PrivateFrameworks/CoreUI.framework/CoreUI", RTLD_NOW) != nil,
      let catalogClass = NSClassFromString("CUICatalog") as? NSObject.Type else {
  FileHandle.standardError.write("CoreUI is unavailable or arguments are missing.\n".data(using: .utf8)!)
  exit(1)
}

typealias InitWithURL = @convention(c) (AnyObject, Selector, NSURL, UnsafeMutablePointer<NSError?>?) -> AnyObject?
let initSelector = NSSelectorFromString("initWithURL:error:")
let allocated = catalogClass.perform(NSSelectorFromString("alloc")).takeUnretainedValue()
guard let catalog = unsafeBitCast(allocated.method(for: initSelector), to: InitWithURL.self)(
  allocated, initSelector, URL(fileURLWithPath: CommandLine.arguments[1]) as NSURL, nil
) as? NSObject else { exit(1) }

func call(_ object: NSObject, _ name: String) -> AnyObject? {
  let selector = NSSelectorFromString(name)
  return object.responds(to: selector) ? object.perform(selector)?.takeUnretainedValue() : nil
}

let output = URL(fileURLWithPath: CommandLine.arguments[2])
for name in (call(catalog, "allImageNames") as? [String]) ?? [] where !name.contains("/") {
  let images = (catalog.perform(NSSelectorFromString("imagesWithName:"), with: name)?.takeUnretainedValue() as? [NSObject]) ?? []
  for image in images {
    guard let raw = call(image, "image") else { continue }
    let cgImage = raw as! CGImage
    let appearance = (call(image, "appearance") as? String) ?? "any"
    let file = output.appendingPathComponent("\(name)-\(appearance)-\(cgImage.width).png")
    guard let destination = CGImageDestinationCreateWithURL(file as CFURL, UTType.png.identifier as CFString, 1, nil) else { continue }
    CGImageDestinationAddImage(destination, cgImage, nil)
    CGImageDestinationFinalize(destination)
    print(file.lastPathComponent)
  }
}
