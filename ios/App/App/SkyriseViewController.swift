import Capacitor

/// The app's web view controller: Capacitor's own, plus the plugins that live inside this
/// app rather than in npm packages (Game Center).
class SkyriseViewController: CAPBridgeViewController {
    override open func capacitorDidLoad() {
        bridge?.registerPluginInstance(GameCenterPlugin())
    }
}
