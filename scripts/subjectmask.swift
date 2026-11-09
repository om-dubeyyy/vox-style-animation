// Apple Vision "lift subject" cut-out for any object (not just people). Free, offline, macOS 14+.
// build: swiftc -O scripts/subjectmask.swift -o scripts/subjectmask   (once; Xcode command-line tools)
// usage: scripts/subjectmask <in.jpg|png> <out.png> [maxside]   → then cutout(scene, "out.png")
// Writes an RGBA PNG: the image with everything but the foreground subject(s) transparent.
import Foundation
import Vision
import CoreImage
import CoreImage.CIFilterBuiltins
import AppKit

let args = CommandLine.arguments
guard args.count >= 3 else { print("usage: subjectmask <in> <out.png> [maxside]"); exit(2) }
let inURL = URL(fileURLWithPath: args[1]), outURL = URL(fileURLWithPath: args[2])
let maxSide = args.count > 3 ? CGFloat(Double(args[3]) ?? 2400) : 2400
guard var ci = CIImage(contentsOf: inURL, options: [.applyOrientationProperty: true]) else { print("cannot read"); exit(1) }
let s = min(1, maxSide / max(ci.extent.width, ci.extent.height))
if s < 1 { ci = ci.transformed(by: CGAffineTransform(scaleX: s, y: s)) }
let req = VNGenerateForegroundInstanceMaskRequest()
let h = VNImageRequestHandler(ciImage: ci)
do {
    try h.perform([req])
    guard let r = req.results?.first else { print("no subject found"); exit(3) }
    let buf = try r.generateMaskedImage(ofInstances: r.allInstances, from: h, croppedToInstancesExtent: false)
    let out = CIImage(cvPixelBuffer: buf)
    let ctx = CIContext()
    guard let cg = ctx.createCGImage(out, from: out.extent) else { print("render fail"); exit(4) }
    let rep = NSBitmapImageRep(cgImage: cg)
    try rep.representation(using: .png, properties: [:])!.write(to: outURL)
    print("ok", outURL.path, Int(out.extent.width), Int(out.extent.height), "instances:", r.allInstances.count)
} catch { print("fail", error); exit(1) }
