import AppKit
import Foundation

final class AppDelegate: NSObject, NSApplicationDelegate {
    private let releases = URL(string: "https://github.com/horner516/lighting-network-analyzer/releases/latest")!
    private var statusItem: NSStatusItem!
    private var server: Process?
    private var dashboardURL: URL?
    private var serverPort: Int?
    private var infoFile: URL!
    private var timer: Timer?

    func applicationDidFinishLaunching(_ notification: Notification) {
        if NSRunningApplication.runningApplications(withBundleIdentifier: Bundle.main.bundleIdentifier ?? "com.luxlink.lighting-network-analyzer").count > 1 {
            NSApp.terminate(nil); return
        }
        statusItem = NSStatusBar.system.statusItem(withLength: NSStatusItem.squareLength)
        if let path = Bundle.main.path(forResource: "app-icon", ofType: "png"), let image = NSImage(contentsOfFile: path) {
            image.size = NSSize(width: 22, height: 22)
            statusItem.button?.image = image
        }
        statusItem.button?.toolTip = "Lux Link"
        rebuildMenu(status: "Starting server…")
        startServer()
    }

    private func startServer() {
        guard let resources = Bundle.main.resourceURL else { showError("App resources are missing."); return }
        infoFile = FileManager.default.temporaryDirectory.appendingPathComponent("lux-link-\(ProcessInfo.processInfo.processIdentifier).json")
        try? FileManager.default.removeItem(at: infoFile)
        let process = Process()
        process.executableURL = resources.appendingPathComponent("node")
        process.arguments = [resources.appendingPathComponent("server.cjs").path, resources.appendingPathComponent("dashboard").path]
        var environment = ProcessInfo.processInfo.environment
        environment["LNA_SERVER_INFO"] = infoFile.path
        environment["LNA_MA_READER"] = resources.appendingPathComponent("MA Web Remote Reader.app/Contents/MacOS/MA Web Remote Reader").path
        process.environment = environment
        let log = Pipe(); process.standardOutput = log; process.standardError = log
        process.terminationHandler = { [weak self] task in DispatchQueue.main.async {
            guard let self, task.terminationStatus != 0 else { return }
            self.rebuildMenu(status: "Server stopped")
            self.showError("The Lux Link server stopped unexpectedly. Open Console for details.")
        }}
        do { try process.run(); server = process }
        catch { showError("Unable to start the bundled server: \(error.localizedDescription)"); return }
        timer = Timer.scheduledTimer(withTimeInterval: 0.25, repeats: true) { [weak self] timer in self?.readServerInfo(timer) }
    }

    private func readServerInfo(_ timer: Timer) {
        guard let data = try? Data(contentsOf: infoFile),
              let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              let rawURL = json["url"] as? String, let url = URL(string: rawURL), let port = json["port"] as? Int else { return }
        timer.invalidate(); self.timer = nil; dashboardURL = url; serverPort = port
        rebuildMenu(status: "Server port: \(port)")
    }

    private func rebuildMenu(status: String) {
        let menu = NSMenu()
        let open = NSMenuItem(title: "Open Browser", action: #selector(openBrowser), keyEquivalent: "o")
        open.target = self; open.isEnabled = dashboardURL != nil; menu.addItem(open)
        let state = NSMenuItem(title: status, action: nil, keyEquivalent: ""); state.isEnabled = false; menu.addItem(state)
        menu.addItem(.separator())
        let updates = NSMenuItem(title: "Check for Updates", action: #selector(checkForUpdates), keyEquivalent: "u")
        updates.target = self; menu.addItem(updates)
        menu.addItem(.separator())
        let quit = NSMenuItem(title: "Quit Lux Link", action: #selector(quitApp), keyEquivalent: "q")
        quit.target = self; menu.addItem(quit)
        statusItem.menu = menu
    }

    @objc private func openBrowser() { if let dashboardURL { NSWorkspace.shared.open(dashboardURL) } }

    @objc private func checkForUpdates() {
        var request = URLRequest(url: URL(string: "https://api.github.com/repos/horner516/lighting-network-analyzer/releases/latest")!)
        request.setValue("application/vnd.github+json", forHTTPHeaderField: "Accept")
        URLSession.shared.dataTask(with: request) { [weak self] data, _, error in
            DispatchQueue.main.async {
                guard let self else { return }
                guard error == nil, let data, let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any], let tag = json["tag_name"] as? String else { self.showError("Unable to check GitHub for updates."); return }
                let current = Bundle.main.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String ?? "0.0.0"
                if self.isNewer(tag, than: current) {
                    let alert = NSAlert(); alert.messageText = "Lux Link \(tag) is available"; alert.informativeText = "Open GitHub to download the new Mac installer?"; alert.addButton(withTitle: "Open Download"); alert.addButton(withTitle: "Later")
                    if alert.runModal() == .alertFirstButtonReturn { NSWorkspace.shared.open(self.releases) }
                } else {
                    let alert = NSAlert(); alert.messageText = "Lux Link is up to date"; alert.informativeText = "Installed version: \(current)"; alert.runModal()
                }
            }
        }.resume()
    }

    private func version(_ value: String) -> [Int] { value.trimmingCharacters(in: CharacterSet(charactersIn: "vV")).split(separator: ".").map { Int($0.prefix { $0.isNumber }) ?? 0 } + [0, 0, 0] }
    private func isNewer(_ candidate: String, than current: String) -> Bool {
        let left = version(candidate), right = version(current)
        for index in 0..<max(left.count, right.count) {
            let a = index < left.count ? left[index] : 0, b = index < right.count ? right[index] : 0
            if a != b { return a > b }
        }
        return false
    }
    private func showError(_ message: String) { let alert = NSAlert(); alert.alertStyle = .critical; alert.messageText = "Lux Link"; alert.informativeText = message; alert.runModal() }
    @objc private func quitApp() { server?.terminate(); try? FileManager.default.removeItem(at: infoFile); NSApp.terminate(nil) }
    func applicationWillTerminate(_ notification: Notification) { timer?.invalidate(); if server?.isRunning == true { server?.terminate() }; if infoFile != nil { try? FileManager.default.removeItem(at: infoFile) } }
}

let app = NSApplication.shared
let delegate = AppDelegate()
app.delegate = delegate
app.setActivationPolicy(.accessory)
app.run()
