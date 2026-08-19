import Cocoa
import WebKit
import ServiceManagement

// build.sh bakes the repo's actual path in at build time (Resources/
// project-dir.txt), since the repo isn't guaranteed to be cloned to any
// particular location. Falls back to ~/Desktop/nudge1 for anyone who
// hand-built without going through build.sh.
let PROJECT_DIR: String = {
    if let path = Bundle.main.path(forResource: "project-dir", ofType: "txt"),
       let raw = try? String(contentsOfFile: path, encoding: .utf8) {
        let trimmed = raw.trimmingCharacters(in: .whitespacesAndNewlines)
        if !trimmed.isEmpty { return trimmed }
    }
    return NSHomeDirectory() + "/Desktop/nudge1"
}()
let LOG_PATH = NSHomeDirectory() + "/Library/Logs/nudge1-worker.log"
let SITE_URL_DEFAULTS_KEY = "nudge1SiteURL"
let SLEEP_MODE_DEFAULTS_KEY = "nudge1SleepMode"
let SLEEP_NOTICE_SHOWN_KEY = "nudge1HasShownSleepNotice"

// Chosen each time the worker starts, from the picker menu on the toolbar's
// worker button. Persisted so the next start (including auto-start at login)
// reuses the last choice.
enum SleepMode: Int {
    case normal = 0
    case preventSleep = 1
    case preventSleepAndDisplay = 2

    var menuTitle: String {
        switch self {
        case .normal: return "Let Mac Sleep Normally"
        case .preventSleep: return "Keep Mac Awake (Recommended)"
        case .preventSleepAndDisplay: return "Keep Mac Awake + Screen On"
        }
    }
}

// Driven by /api/health, not just whether the process handle exists — a
// lid-close/reopen suspends the worker without killing it, and its
// Postgres/Redis connections are often dead on resume even though the
// process itself is still alive. "Running" only means the last health
// check actually confirmed it; "unresponsive" is that zombie state.
enum WorkerStatus {
    case stopped
    case starting
    case healthy
    case unresponsive
}

extension NSToolbarItem.Identifier {
    static let back = NSToolbarItem.Identifier("back")
    static let forward = NSToolbarItem.Identifier("forward")
    static let reload = NSToolbarItem.Identifier("reload")
    static let urlField = NSToolbarItem.Identifier("urlField")
    static let workerToggle = NSToolbarItem.Identifier("workerToggle")
}

// macOS 26's toolbar chrome overrides NSButton's bezelColor with its own
// "Liquid Glass" tint, so a plain colored bezel button doesn't actually show
// green/red there. Drawing the pill by hand sidesteps that entirely.
class WorkerStatusButton: NSButton {
    var fillColor: NSColor = .systemGray {
        didSet { needsDisplay = true }
    }

    override func draw(_ dirtyRect: NSRect) {
        let path = NSBezierPath(roundedRect: bounds, xRadius: bounds.height / 2, yRadius: bounds.height / 2)
        fillColor.setFill()
        path.fill()

        let attrs: [NSAttributedString.Key: Any] = [
            .foregroundColor: NSColor.white,
            .font: NSFont.systemFont(ofSize: NSFont.systemFontSize, weight: .semibold)
        ]
        let str = title as NSString
        let size = str.size(withAttributes: attrs)
        let rect = NSRect(
            x: (bounds.width - size.width) / 2,
            y: (bounds.height - size.height) / 2,
            width: size.width,
            height: size.height
        )
        str.draw(in: rect, withAttributes: attrs)
    }
}

class AppDelegate: NSObject, NSApplicationDelegate, NSToolbarDelegate, WKNavigationDelegate, WKUIDelegate, WKDownloadDelegate, NSWindowDelegate, NSTextFieldDelegate, NSMenuDelegate {
    var window: NSWindow!
    var webView: WKWebView!
    var statusItem: NSStatusItem!
    var workerProcess: Process?
    var caffeinateProcess: Process?
    var workerToolbarButton: WorkerStatusButton?
    var urlTextField: NSTextField?
    var launchAtLoginMenuItem: NSMenuItem?
    var downloadDestinations: [ObjectIdentifier: URL] = [:]
    var workerStatus: WorkerStatus = .stopped
    var healthCheckTimer: Timer?

    func applicationDidFinishLaunching(_ notification: Notification) {
        NSApp.setActivationPolicy(.regular)
        setupMainMenu()
        setupWindow()
        setupStatusItem()
        webView.load(URLRequest(url: resolveSiteURL()))
        startWorker()

        NSWorkspace.shared.notificationCenter.addObserver(
            self, selector: #selector(systemDidWake),
            name: NSWorkspace.didWakeNotification, object: nil)

        // Baseline cadence while the worker's supposed to be running. Timers
        // don't fire while the Mac is actually asleep, so this only costs
        // anything while awake — matched to the worker's own 60s heartbeat
        // cadence (checking faster than that just re-reads the same value).
        // menuWillOpen() and systemDidWake() below trigger extra checks
        // right when they're actually useful, on top of this.
        healthCheckTimer = Timer.scheduledTimer(withTimeInterval: 90, repeats: true) { [weak self] _ in
            self?.checkWorkerHealth()
        }

        // Force the window to the front on a later runloop tick, past any
        // state-restoration/activation races that can otherwise leave a
        // freshly created window ordered-in but not actually visible.
        DispatchQueue.main.async {
            NSApp.activate(ignoringOtherApps: true)
            self.window.makeKeyAndOrderFront(nil)
            self.window.orderFrontRegardless()
        }
    }

    func applicationWillTerminate(_ notification: Notification) {
        stopWorker()
    }

    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool {
        // Keep the worker (and menu bar controls) alive when the window closes.
        false
    }

    // Clicking the Dock icon is a separate path from the menu bar's "Open
    // Dashboard" item (showWindowAction) — without this, a minimized window
    // can be left stuck with no way back short of quitting and relaunching.
    func applicationShouldHandleReopen(_ sender: NSApplication, hasVisibleWindows flag: Bool) -> Bool {
        showWindowAction()
        return true
    }

    // MARK: - Site URL
    //
    // Not hardcoded, because this app is meant to be built by anyone
    // self-hosting Nudge1, pointed at their own deployment. Priority:
    // 1. A URL the user set later via "Change Site URL..."
    // 2. site-url.txt, bundled into Resources at build time — this is what
    //    an AI-assistant-driven setup writes automatically, so building
    //    and launching the app needs zero manual input.
    // 3. An interactive prompt, only for someone who ran build.sh by hand
    //    without filling in site-url.txt first.

    func resolveSiteURL() -> URL {
        knownSiteURL() ?? promptForSiteURL()
    }

    // Same lookup as resolveSiteURL(), minus the interactive fallback —
    // background health checks must never pop the "where did you deploy"
    // prompt just because nothing's configured yet.
    func knownSiteURL() -> URL? {
        if let saved = UserDefaults.standard.string(forKey: SITE_URL_DEFAULTS_KEY),
           let url = URL(string: saved) {
            return url
        }
        if let bundled = Bundle.main.path(forResource: "site-url", ofType: "txt"),
           let raw = try? String(contentsOfFile: bundled, encoding: .utf8) {
            let trimmed = raw.trimmingCharacters(in: .whitespacesAndNewlines)
            if let url = URL(string: trimmed), url.host != nil {
                return url
            }
        }
        return nil
    }

    @discardableResult
    func promptForSiteURL() -> URL {
        while true {
            let alert = NSAlert()
            alert.messageText = "Where did you deploy Nudge1?"
            alert.informativeText = "Enter the URL Vercel gave you, e.g. your-app.vercel.app"
            alert.addButton(withTitle: "Continue")
            let input = NSTextField(frame: NSRect(x: 0, y: 0, width: 280, height: 24))
            input.placeholderString = "your-app.vercel.app"
            alert.accessoryView = input
            NSApp.activate(ignoringOtherApps: true)
            alert.window.makeFirstResponder(input)
            alert.runModal()

            let raw = input.stringValue.trimmingCharacters(in: .whitespacesAndNewlines)
            guard !raw.isEmpty else { continue }
            let candidate = raw.contains("://") ? raw : "https://\(raw)"
            guard let url = URL(string: candidate), url.host != nil else { continue }

            UserDefaults.standard.set(candidate, forKey: SITE_URL_DEFAULTS_KEY)
            return url
        }
    }

    @objc func changeSiteURLAction() {
        UserDefaults.standard.removeObject(forKey: SITE_URL_DEFAULTS_KEY)
        webView.load(URLRequest(url: promptForSiteURL()))
    }

    // SMAppService.mainApp registers this exact app bundle as a login item
    // — no separate helper-app target needed on macOS 13+. Re-launching at
    // login runs applicationDidFinishLaunching the same as a normal launch,
    // so the worker starts automatically; no separate startup path needed.
    @objc func toggleLaunchAtLoginAction() {
        do {
            if SMAppService.mainApp.status == .enabled {
                try SMAppService.mainApp.unregister()
            } else {
                try SMAppService.mainApp.register()
            }
        } catch {
            NSLog("Failed to toggle launch-at-login: \(error)")
        }
        launchAtLoginMenuItem?.state = SMAppService.mainApp.status == .enabled ? .on : .off
    }

    // MARK: - UI setup

    func setupMainMenu() {
        let mainMenu = NSMenu()

        let appMenuItem = NSMenuItem()
        mainMenu.addItem(appMenuItem)
        let appMenu = NSMenu()
        appMenu.addItem(withTitle: "Quit Nudge1", action: #selector(NSApplication.terminate(_:)), keyEquivalent: "q")
        appMenuItem.submenu = appMenu

        let editMenuItem = NSMenuItem()
        mainMenu.addItem(editMenuItem)
        let editMenu = NSMenu(title: "Edit")
        editMenu.addItem(withTitle: "Undo", action: Selector(("undo:")), keyEquivalent: "z")
        editMenu.addItem(withTitle: "Redo", action: Selector(("redo:")), keyEquivalent: "Z")
        editMenu.addItem(NSMenuItem.separator())
        editMenu.addItem(withTitle: "Cut", action: #selector(NSText.cut(_:)), keyEquivalent: "x")
        editMenu.addItem(withTitle: "Copy", action: #selector(NSText.copy(_:)), keyEquivalent: "c")
        editMenu.addItem(withTitle: "Paste", action: #selector(NSText.paste(_:)), keyEquivalent: "v")
        editMenu.addItem(withTitle: "Select All", action: #selector(NSText.selectAll(_:)), keyEquivalent: "a")
        editMenuItem.submenu = editMenu

        let viewMenuItem = NSMenuItem()
        mainMenu.addItem(viewMenuItem)
        let viewMenu = NSMenu(title: "View")
        viewMenu.addItem(withTitle: "Reload", action: #selector(reloadAction), keyEquivalent: "r")
        viewMenu.addItem(withTitle: "Change Site URL...", action: #selector(changeSiteURLAction), keyEquivalent: "")
        viewMenu.addItem(NSMenuItem.separator())
        let launchAtLoginItem = viewMenu.addItem(withTitle: "Launch at Login", action: #selector(toggleLaunchAtLoginAction), keyEquivalent: "")
        launchAtLoginItem.state = SMAppService.mainApp.status == .enabled ? .on : .off
        launchAtLoginMenuItem = launchAtLoginItem
        viewMenuItem.submenu = viewMenu

        NSApp.mainMenu = mainMenu
    }

    func setupWindow() {
        let screenSize = NSScreen.main?.frame.size ?? NSSize(width: 1280, height: 800)
        let winSize = NSSize(width: min(1280, screenSize.width - 100), height: min(860, screenSize.height - 100))
        window = NSWindow(
            contentRect: NSRect(origin: .zero, size: winSize),
            styleMask: [.titled, .closable, .miniaturizable, .resizable],
            backing: .buffered, defer: false)
        window.title = "Nudge1"
        window.center()
        window.delegate = self
        window.isRestorable = false
        window.appearance = NSAppearance(named: .darkAqua)

        webView = WKWebView(frame: .zero, configuration: WKWebViewConfiguration())
        webView.navigationDelegate = self
        webView.uiDelegate = self
        window.contentView = webView

        let toolbar = NSToolbar(identifier: "MainToolbar")
        toolbar.delegate = self
        toolbar.displayMode = .iconAndLabel
        window.toolbar = toolbar

        window.makeKeyAndOrderFront(nil)
        NSApp.activate(ignoringOtherApps: true)
    }

    func setupStatusItem() {
        statusItem = NSStatusBar.system.statusItem(withLength: NSStatusItem.squareLength)
        refreshStatusItem()
    }

    // (dot glyph, menu/toolbar label, toolbar pill color) for each status.
    func statusPresentation(for status: WorkerStatus) -> (String, String, NSColor) {
        switch status {
        case .stopped: return ("\u{25CB}", "Worker: Stopped", .systemRed)
        case .starting: return ("\u{25D0}", "Worker: Starting…", .systemGray)
        case .healthy: return ("\u{25CF}", "Worker: Running", .systemGreen)
        case .unresponsive: return ("\u{25CF}", "Worker: Unresponsive", .systemOrange)
        }
    }

    func buildStatusMenu() -> NSMenu {
        let menu = NSMenu()
        // Fires a fresh health check right as the dropdown opens, so
        // opening it is itself one of the "check right when it's useful"
        // moments instead of only relying on the 90s timer.
        menu.delegate = self
        let (_, label, _) = statusPresentation(for: workerStatus)
        let statusLabel = NSMenuItem(title: label, action: nil, keyEquivalent: "")
        statusLabel.isEnabled = false
        menu.addItem(statusLabel)
        menu.addItem(NSMenuItem.separator())
        menu.addItem(withTitle: "Start Worker", action: #selector(startWorkerAction), keyEquivalent: "")
        menu.addItem(withTitle: "Stop Worker", action: #selector(stopWorkerAction), keyEquivalent: "")
        menu.addItem(withTitle: "Restart Worker", action: #selector(restartWorkerAction), keyEquivalent: "")
        menu.addItem(NSMenuItem.separator())
        menu.addItem(withTitle: "Open Dashboard", action: #selector(showWindowAction), keyEquivalent: "")
        menu.addItem(withTitle: "View Worker Logs", action: #selector(openLogsAction), keyEquivalent: "")
        menu.addItem(NSMenuItem.separator())
        menu.addItem(withTitle: "Quit", action: #selector(NSApplication.terminate(_:)), keyEquivalent: "")
        return menu
    }

    func menuWillOpen(_ menu: NSMenu) {
        checkWorkerHealth()
    }

    func refreshStatusItem() {
        let (dot, label, color) = statusPresentation(for: workerStatus)
        statusItem.button?.title = "\(dot) OR"
        statusItem.menu = buildStatusMenu()

        if let button = workerToolbarButton {
            button.title = label
            button.fillColor = color
            button.needsDisplay = true
        }
    }

    // MARK: - Toolbar

    func toolbar(_ toolbar: NSToolbar, itemForItemIdentifier itemIdentifier: NSToolbarItem.Identifier, willBeInsertedIntoToolbar flag: Bool) -> NSToolbarItem? {
        switch itemIdentifier {
        case .back:
            let item = NSToolbarItem(itemIdentifier: itemIdentifier)
            item.label = "Back"
            item.view = NSButton(image: NSImage(systemSymbolName: "chevron.left", accessibilityDescription: "Back")!, target: self, action: #selector(backAction))
            return item
        case .forward:
            let item = NSToolbarItem(itemIdentifier: itemIdentifier)
            item.label = "Forward"
            item.view = NSButton(image: NSImage(systemSymbolName: "chevron.right", accessibilityDescription: "Forward")!, target: self, action: #selector(forwardAction))
            return item
        case .reload:
            let item = NSToolbarItem(itemIdentifier: itemIdentifier)
            item.label = "Reload"
            item.view = NSButton(image: NSImage(systemSymbolName: "arrow.clockwise", accessibilityDescription: "Reload")!, target: self, action: #selector(reloadAction))
            return item
        case .urlField:
            let item = NSToolbarItem(itemIdentifier: itemIdentifier)
            item.label = "Go to link"
            let field = NSTextField()
            field.placeholderString = "Paste a link (e.g. a magic-link email) and press Return"
            field.delegate = self
            field.target = self
            field.action = #selector(loadURLFromField)
            field.bezelStyle = .roundedBezel
            field.widthAnchor.constraint(equalToConstant: 420).isActive = true
            urlTextField = field
            item.view = field
            return item
        case .workerToggle:
            let item = NSToolbarItem(itemIdentifier: itemIdentifier)
            item.label = "Worker"
            let btn = WorkerStatusButton(title: "Worker: Stopped", target: self, action: #selector(toggleWorkerAction))
            btn.isBordered = false
            btn.setButtonType(.momentaryChange)
            btn.widthAnchor.constraint(equalToConstant: 140).isActive = true
            btn.heightAnchor.constraint(equalToConstant: 24).isActive = true
            workerToolbarButton = btn
            item.view = btn
            return item
        default:
            return nil
        }
    }

    func toolbarDefaultItemIdentifiers(_ toolbar: NSToolbar) -> [NSToolbarItem.Identifier] {
        [.urlField, .back, .forward, .reload, .flexibleSpace, .workerToggle]
    }

    func toolbarAllowedItemIdentifiers(_ toolbar: NSToolbar) -> [NSToolbarItem.Identifier] {
        [.urlField, .back, .forward, .reload, .flexibleSpace, .workerToggle]
    }

    // MARK: - Actions

    @objc func startWorkerAction() { startWorker() }
    @objc func stopWorkerAction() { confirmStopWorker() }
    @objc func toggleWorkerAction() {
        if workerProcess != nil {
            confirmStopWorker()
        } else {
            presentStartMenu()
        }
    }

    // The toolbar's worker button, clicked while stopped: offers the sleep
    // mode to start with instead of silently reusing whatever ran last. A
    // popup dialog, matching confirmStopWorker() below, rather than a menu.
    func presentStartMenu() {
        let alert = NSAlert()
        alert.messageText = "Start the worker"
        alert.informativeText = "Choose one:"
        alert.alertStyle = .informational
        // First-added button is the rightmost and the Return-key default.
        alert.addButton(withTitle: SleepMode.preventSleep.menuTitle)
        alert.addButton(withTitle: SleepMode.preventSleepAndDisplay.menuTitle)
        alert.addButton(withTitle: SleepMode.normal.menuTitle)
        alert.addButton(withTitle: "Cancel")

        let handleResponse: (NSApplication.ModalResponse) -> Void = { [weak self] response in
            let mode: SleepMode?
            switch response {
            case .alertFirstButtonReturn: mode = .preventSleep
            case .alertSecondButtonReturn: mode = .preventSleepAndDisplay
            case .alertThirdButtonReturn: mode = .normal
            default: mode = nil // Cancel
            }
            if let mode {
                self?.startWorker(mode: mode)
            }
        }

        if let window = window, window.isVisible {
            alert.beginSheetModal(for: window) { response in handleResponse(response) }
        } else {
            NSApp.activate(ignoringOtherApps: true)
            handleResponse(alert.runModal())
        }
    }

    func currentSleepMode() -> SleepMode {
        if UserDefaults.standard.object(forKey: SLEEP_MODE_DEFAULTS_KEY) == nil {
            return .preventSleep
        }
        return SleepMode(rawValue: UserDefaults.standard.integer(forKey: SLEEP_MODE_DEFAULTS_KEY)) ?? .preventSleep
    }

    // Stopping pauses live DM delivery, so guard against an accidental click
    // with a confirmation. Cancel is the default (Return-key-safe) button;
    // Stop Worker requires an explicit click, per Apple's HIG for cautionary actions.
    func confirmStopWorker() {
        guard workerProcess != nil else { return }
        let alert = NSAlert()
        alert.messageText = "Stop the worker?"
        alert.informativeText = "New comments won't get DM replies until you start it again."
        alert.alertStyle = .warning
        alert.addButton(withTitle: "Cancel")
        alert.addButton(withTitle: "Stop Worker")

        if let window = window, window.isVisible {
            alert.beginSheetModal(for: window) { [weak self] response in
                if response == .alertSecondButtonReturn {
                    self?.stopWorker()
                }
            }
        } else {
            NSApp.activate(ignoringOtherApps: true)
            if alert.runModal() == .alertSecondButtonReturn {
                stopWorker()
            }
        }
    }
    @objc func reloadAction() { webView.reload() }

    @objc func loadURLFromField() {
        guard let text = urlTextField?.stringValue.trimmingCharacters(in: .whitespacesAndNewlines),
              !text.isEmpty else { return }
        let candidate = text.contains("://") ? text : "https://\(text)"
        guard let url = URL(string: candidate) else { return }
        webView.load(URLRequest(url: url))
        urlTextField?.stringValue = ""
        window.makeFirstResponder(webView)
    }
    @objc func backAction() { webView.goBack() }
    @objc func forwardAction() { webView.goForward() }

    @objc func showWindowAction() {
        // makeKeyAndOrderFront is supposed to implicitly deminiaturize a
        // minimized window, but that's flaky in practice on some macOS
        // versions — a minimized window can stay stuck even though this
        // gets called. Deminiaturizing explicitly first is the reliable path.
        if window.isMiniaturized {
            window.deminiaturize(nil)
        }
        window.makeKeyAndOrderFront(nil)
        NSApp.activate(ignoringOtherApps: true)
    }

    @objc func openLogsAction() {
        NSWorkspace.shared.open(URL(fileURLWithPath: LOG_PATH))
    }

    func windowShouldClose(_ sender: NSWindow) -> Bool {
        sender.orderOut(nil)
        return false
    }

    // MARK: - Worker process management

    func startWorker(mode: SleepMode? = nil) {
        guard workerProcess == nil else { return }
        let resolvedMode = mode ?? currentSleepMode()
        UserDefaults.standard.set(resolvedMode.rawValue, forKey: SLEEP_MODE_DEFAULTS_KEY)

        if !FileManager.default.fileExists(atPath: LOG_PATH) {
            FileManager.default.createFile(atPath: LOG_PATH, contents: nil)
        }
        guard let logHandle = FileHandle(forWritingAtPath: LOG_PATH) else { return }
        logHandle.seekToEndOfFile()

        let process = Process()
        process.executableURL = URL(fileURLWithPath: "/bin/zsh")
        // A login shell (-l) sources the user's profile so PATH includes
        // Homebrew's npm/node — GUI-launched apps don't inherit Terminal's PATH.
        process.arguments = ["-l", "-c", "cd \(PROJECT_DIR) && npm run worker"]
        process.standardOutput = logHandle
        process.standardError = logHandle
        process.terminationHandler = { [weak self] _ in
            DispatchQueue.main.async {
                self?.workerProcess = nil
                self?.workerStatus = .stopped
                self?.refreshStatusItem()
            }
        }
        do {
            try process.run()
            workerProcess = process
            workerStatus = .starting
            startCaffeinate(watchingPid: process.processIdentifier, mode: resolvedMode)
            // The worker takes a few seconds to boot (npm, then tsx
            // transpiling) before it writes its first heartbeat, so an
            // immediate reload would still show it as stopped.
            DispatchQueue.main.asyncAfter(deadline: .now() + 4) { [weak self] in
                self?.webView.reload()
            }
            // Enough time for the boot above plus one heartbeat write, so
            // the status moves off "Starting…" without waiting for the
            // next scheduled 90s tick.
            DispatchQueue.main.asyncAfter(deadline: .now() + 8) { [weak self] in
                self?.checkWorkerHealth()
            }
        } catch {
            NSLog("Failed to start worker: \(error)")
        }
        refreshStatusItem()
    }

    // Queries the same /api/health the dashboard uses, rather than just
    // checking whether the process handle is still alive — a lid-close
    // suspends the worker without killing it, so the process can be
    // "alive" while its Postgres/Redis connections are actually dead.
    func checkWorkerHealth() {
        guard workerProcess != nil else {
            if workerStatus != .stopped {
                workerStatus = .stopped
                refreshStatusItem()
            }
            return
        }
        guard let base = knownSiteURL(),
              let healthURL = URL(string: "api/health", relativeTo: base) else { return }

        var request = URLRequest(url: healthURL)
        request.timeoutInterval = 10
        URLSession.shared.dataTask(with: request) { [weak self] data, _, error in
            DispatchQueue.main.async {
                guard let self, self.workerProcess != nil else { return }
                var healthy = false
                if let data, error == nil,
                   let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
                   let checks = json["checks"] as? [String: Any],
                   let worker = checks["worker"] as? [String: Any],
                   let h = worker["healthy"] as? Bool {
                    healthy = h
                }
                self.workerStatus = healthy ? .healthy : .unresponsive
                self.refreshStatusItem()
            }
        }.resume()
    }

    // Sleep (lid close, unless an external display is attached — see the
    // notice in startCaffeinate below) suspends the worker process without
    // killing it. On wake the process resumes, but its Postgres/Redis
    // connections are frequently dead, leaving a "zombie" worker: alive,
    // but not actually processing anything. A fresh restart is cheap and
    // safe (BullMQ jobs are durable and retry), so just do that
    // automatically instead of leaving it to look fine and quietly do
    // nothing until someone notices and restarts the app by hand.
    @objc func systemDidWake() {
        guard workerProcess != nil else { return }
        NSLog("[Nudge1] Woke from sleep — restarting worker to clear stale connections")
        stopWorker()
        DispatchQueue.main.asyncAfter(deadline: .now() + 3) { [weak self] in
            self?.startWorker()
        }
    }

    @objc func restartWorkerAction() {
        if workerProcess != nil {
            stopWorker()
            DispatchQueue.main.asyncAfter(deadline: .now() + 1) { [weak self] in
                self?.startWorker()
            }
        } else {
            startWorker()
        }
    }

    // Keeps the system (and optionally the display) awake for exactly as
    // long as the worker's shell process is alive: -i blocks idle sleep, -s
    // blocks sleep while on AC power, -w ties the assertion to the worker's
    // PID so caffeinate exits on its own the moment the worker does. Normal
    // mode skips caffeinate entirely, so the Mac can sleep as usual — the
    // worker just won't run while it's asleep. Neither caffeinate mode
    // overrides a closed laptop lid without an external display attached —
    // that's a hardware-level sleep macOS enforces regardless.
    func startCaffeinate(watchingPid pid: Int32, mode: SleepMode) {
        guard mode != .normal else { return }

        let caffeinate = Process()
        caffeinate.executableURL = URL(fileURLWithPath: "/usr/bin/caffeinate")
        var arguments = ["-i", "-s", "-w", String(pid)]
        if mode == .preventSleepAndDisplay {
            arguments.append("-d")
        }
        caffeinate.arguments = arguments
        try? caffeinate.run()
        caffeinateProcess = caffeinate

        maybeShowSleepNotice()
    }

    // Shown once, ever — closing the lid sleeps the Mac regardless of the
    // caffeinate flags above (that's a hardware-level policy macOS enforces
    // outside any app's control), so the worker needs the lid open or an
    // external display attached to keep running.
    func maybeShowSleepNotice() {
        guard !UserDefaults.standard.bool(forKey: SLEEP_NOTICE_SHOWN_KEY) else { return }
        UserDefaults.standard.set(true, forKey: SLEEP_NOTICE_SHOWN_KEY)

        let alert = NSAlert()
        alert.messageText = "Keep your Mac's lid open"
        alert.informativeText = "Nudge1 keeps your Mac awake while the worker is running, so comments keep getting DMs. Closing the lid still puts the Mac to sleep regardless — unless it's connected to an external display. Leave the lid open (or plug in a monitor) for the worker to keep running."
        alert.addButton(withTitle: "Got it")
        if window.isVisible {
            alert.beginSheetModal(for: window)
        } else {
            NSApp.activate(ignoringOtherApps: true)
            alert.runModal()
        }
    }

    func stopWorker() {
        let pid = workerProcess?.processIdentifier
        workerProcess?.terminate()
        workerProcess = nil
        workerStatus = .stopped
        caffeinateProcess?.terminate()
        caffeinateProcess = nil
        // terminate() signals npm directly (zsh execs into it rather than
        // forking, for a single `-c` command), but npm's own tsx/node
        // children can survive as orphans. npm starts as its own process
        // group leader, so killing that whole group catches every
        // descendant regardless of depth — scoped to just this worker's
        // tree. A blanket `pkill -f dm-worker.ts` would also kill a second
        // Nudge1 instance's worker (e.g. while testing a build).
        if let pid = pid {
            let killProcess = Process()
            killProcess.executableURL = URL(fileURLWithPath: "/usr/bin/pkill")
            killProcess.arguments = ["-g", String(pid)]
            try? killProcess.run()
        }
        refreshStatusItem()
        webView.reload()
    }

    // MARK: - WKNavigationDelegate

    func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        decisionHandler(.allow)
    }

    // WKWebView has no download support at all unless the app opts a
    // response into it here — without this, clicking an export/download
    // link (Content-Disposition: attachment, or any file WKWebView can't
    // render inline, like .xlsx) just does nothing with no error, since the
    // webview tries and fails to "navigate" to it as a page.
    func webView(_ webView: WKWebView, decidePolicyFor navigationResponse: WKNavigationResponse, decisionHandler: @escaping (WKNavigationResponsePolicy) -> Void) {
        decisionHandler(navigationResponse.canShowMIMEType ? .allow : .download)
    }

    func webView(_ webView: WKWebView, navigationAction: WKNavigationAction, didBecome download: WKDownload) {
        download.delegate = self
    }

    func webView(_ webView: WKWebView, navigationResponse: WKNavigationResponse, didBecome download: WKDownload) {
        download.delegate = self
    }

    // MARK: - WKUIDelegate (target="_blank" / window.open)
    //
    // Without this, WKWebView silently drops any navigationAction that
    // wants a new window (target="_blank" links, window.open()) — the
    // click just does nothing, no error. Route those out to the user's
    // default browser instead of trying to spawn a second WKWebView.
    func webView(
        _ webView: WKWebView,
        createWebViewWith configuration: WKWebViewConfiguration,
        for navigationAction: WKNavigationAction,
        windowFeatures: WKWindowFeatures
    ) -> WKWebView? {
        if let url = navigationAction.request.url {
            NSWorkspace.shared.open(url)
        }
        return nil
    }

    // MARK: - WKUIDelegate (JS alert/confirm/prompt)
    //
    // WKWebView shows nothing for window.alert/confirm/prompt unless a
    // uiDelegate implements these — without it, a page's confirm() just
    // returns undefined silently, which reads as "the button does nothing"
    // (this is exactly what broke the dashboard's delete-campaign button).

    func webView(
        _ webView: WKWebView,
        runJavaScriptAlertPanelWithMessage message: String,
        initiatedByFrame frame: WKFrameInfo,
        completionHandler: @escaping () -> Void
    ) {
        let alert = NSAlert()
        alert.messageText = message
        alert.addButton(withTitle: "OK")
        if window.isVisible {
            alert.beginSheetModal(for: window) { _ in completionHandler() }
        } else {
            NSApp.activate(ignoringOtherApps: true)
            alert.runModal()
            completionHandler()
        }
    }

    func webView(
        _ webView: WKWebView,
        runJavaScriptConfirmPanelWithMessage message: String,
        initiatedByFrame frame: WKFrameInfo,
        completionHandler: @escaping (Bool) -> Void
    ) {
        let alert = NSAlert()
        alert.messageText = message
        alert.addButton(withTitle: "OK")
        alert.addButton(withTitle: "Cancel")
        if window.isVisible {
            alert.beginSheetModal(for: window) { response in
                completionHandler(response == .alertFirstButtonReturn)
            }
        } else {
            NSApp.activate(ignoringOtherApps: true)
            completionHandler(alert.runModal() == .alertFirstButtonReturn)
        }
    }

    func webView(
        _ webView: WKWebView,
        runJavaScriptTextInputPanelWithPrompt prompt: String,
        defaultText: String?,
        initiatedByFrame frame: WKFrameInfo,
        completionHandler: @escaping (String?) -> Void
    ) {
        let alert = NSAlert()
        alert.messageText = prompt
        alert.addButton(withTitle: "OK")
        alert.addButton(withTitle: "Cancel")
        let input = NSTextField(frame: NSRect(x: 0, y: 0, width: 280, height: 24))
        input.stringValue = defaultText ?? ""
        alert.accessoryView = input
        NSApp.activate(ignoringOtherApps: true)
        let response = alert.runModal()
        completionHandler(response == .alertFirstButtonReturn ? input.stringValue : nil)
    }

    // MARK: - WKDownloadDelegate

    func download(
        _ download: WKDownload,
        decideDestinationUsing response: URLResponse,
        suggestedFilename: String,
        completionHandler: @escaping (URL?) -> Void
    ) {
        let downloadsDir = FileManager.default.urls(for: .downloadsDirectory, in: .userDomainMask).first
            ?? URL(fileURLWithPath: NSHomeDirectory() + "/Downloads")
        let base = (suggestedFilename as NSString).deletingPathExtension
        let ext = (suggestedFilename as NSString).pathExtension
        var destination = downloadsDir.appendingPathComponent(suggestedFilename)
        var counter = 1
        while FileManager.default.fileExists(atPath: destination.path) {
            destination = downloadsDir.appendingPathComponent("\(base) (\(counter)).\(ext)")
            counter += 1
        }
        downloadDestinations[ObjectIdentifier(download)] = destination
        completionHandler(destination)
    }

    func downloadDidFinish(_ download: WKDownload) {
        if let url = downloadDestinations.removeValue(forKey: ObjectIdentifier(download)) {
            NSWorkspace.shared.activateFileViewerSelecting([url])
        }
    }

    func download(_ download: WKDownload, didFailWithError error: Error, resumeData: Data?) {
        downloadDestinations.removeValue(forKey: ObjectIdentifier(download))
        NSLog("Download failed: \(error)")
    }
}

let app = NSApplication.shared
let delegate = AppDelegate()
app.delegate = delegate
app.run()
