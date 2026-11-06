// Prints the on-screen windows of ONE process as JSON: winlist <pid>   (never lists other apps' windows)
import Cocoa
guard CommandLine.arguments.count > 1, let pid = Int32(CommandLine.arguments[1]) else { print("[]"); exit(0) }
let opts: CGWindowListOption = [.optionOnScreenOnly, .excludeDesktopElements]
let list = (CGWindowListCopyWindowInfo(opts, kCGNullWindowID) as? [[String: Any]]) ?? []
var out: [[String: Any]] = []
for w in list {
    guard let p = w[kCGWindowOwnerPID as String] as? Int32, p == pid else { continue }
    let b = w[kCGWindowBounds as String] as? [String: Any] ?? [:]
    out.append([
        "id": w[kCGWindowNumber as String] ?? 0, "name": w[kCGWindowName as String] ?? "",
        "layer": w[kCGWindowLayer as String] ?? 0, "x": b["X"] ?? 0, "y": b["Y"] ?? 0, "w": b["Width"] ?? 0, "h": b["Height"] ?? 0,
    ])
}
let data = try! JSONSerialization.data(withJSONObject: out)
print(String(data: data, encoding: .utf8)!)
