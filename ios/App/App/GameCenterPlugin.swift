import Capacitor
import GameKit

/// Game Center for Skyrise: signs the player in, posts scores to the leaderboards, reports
/// trophies as achievements and opens Apple's leaderboard screen. Called from
/// src/gamecenter.ts. Every call resolves (never rejects), so the game carries on normally
/// when the player isn't signed in to Game Center.
@objc(GameCenterPlugin)
public class GameCenterPlugin: CAPPlugin, CAPBridgedPlugin, GKGameCenterControllerDelegate {
    public let identifier = "GameCenterPlugin"
    public let jsName = "GameCenter"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "signIn", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "submitScore", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "unlockAchievements", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "showLeaderboard", returnType: CAPPluginReturnPromise),
    ]

    @objc func signIn(_ call: CAPPluginCall) {
        let player = GKLocalPlayer.local
        if player.isAuthenticated {
            call.resolve(["signedIn": true])
            return
        }
        var answered = false
        player.authenticateHandler = { [weak self] viewController, _ in
            if let viewController = viewController {
                // Apple's own sign-in sheet.
                DispatchQueue.main.async { self?.bridge?.viewController?.present(viewController, animated: true) }
                return
            }
            if !answered {
                answered = true
                call.resolve(["signedIn": GKLocalPlayer.local.isAuthenticated])
            }
        }
    }

    @objc func submitScore(_ call: CAPPluginCall) {
        guard GKLocalPlayer.local.isAuthenticated,
              let board = call.getString("leaderboard"),
              let score = call.getInt("score") else {
            call.resolve(["ok": false])
            return
        }
        GKLeaderboard.submitScore(score, context: 0, player: GKLocalPlayer.local, leaderboardIDs: [board]) { error in
            call.resolve(["ok": error == nil])
        }
    }

    @objc func unlockAchievements(_ call: CAPPluginCall) {
        guard GKLocalPlayer.local.isAuthenticated else {
            call.resolve(["ok": false])
            return
        }
        let ids = call.getArray("ids", String.self) ?? []
        if ids.isEmpty {
            call.resolve(["ok": true])
            return
        }
        let achievements = ids.map { id -> GKAchievement in
            let a = GKAchievement(identifier: id)
            a.percentComplete = 100
            a.showsCompletionBanner = true
            return a
        }
        GKAchievement.report(achievements) { error in
            call.resolve(["ok": error == nil])
        }
    }

    @objc func showLeaderboard(_ call: CAPPluginCall) {
        guard GKLocalPlayer.local.isAuthenticated else {
            call.resolve(["ok": false])
            return
        }
        let board = call.getString("leaderboard") ?? ""
        DispatchQueue.main.async {
            let vc = board.isEmpty
                ? GKGameCenterViewController(state: .leaderboards)
                : GKGameCenterViewController(leaderboardID: board, playerScope: .global, timeScope: .allTime)
            vc.gameCenterDelegate = self
            self.bridge?.viewController?.present(vc, animated: true)
            call.resolve(["ok": true])
        }
    }

    public func gameCenterViewControllerDidFinish(_ gameCenterViewController: GKGameCenterViewController) {
        gameCenterViewController.dismiss(animated: true)
    }
}
