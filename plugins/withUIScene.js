const { withAppDelegate, withInfoPlist } = require('@expo/config-plugins');

// iOS 27 cierra al arrancar (EXC_BREAKPOINT en
// _UIApplicationEvaluateRuntimeIssueForNoSceneLifecycleAdoption) toda app
// compilada con el SDK de Xcode 27 que no use el ciclo de vida UIScene. El
// AppDelegate que genera Expo 54 crea la ventana en didFinishLaunching, que es
// justo el modelo viejo.
//
// Esto:
//  1. Declara UIApplicationSceneManifest en el Info.plist.
//  2. Saca del AppDelegate la creación de la ventana y el arranque de React
//     Native (la fábrica se sigue creando ahí, igual que FirebaseApp).
//  3. Agrega un SceneDelegate al final de AppDelegate.swift (mismo archivo, así
//     no hay que tocar el .pbxproj) que crea la ventana en la escena y arranca
//     React Native en ella.
//
// Con escenas, iOS ya no llama a application(_:open:options:) ni a
// application(_:continue:...) del AppDelegate: los deep links llegan a la
// escena. El SceneDelegate se los reenvía al AppDelegate para que sigan
// pasando por los subscribers de Expo y por RCTLinkingManager como antes.
//
// Sacarlo cuando Expo traiga soporte propio de escenas.

const SCENE_DELEGATE = `
// @generated begin withUIScene (plugins/withUIScene.js)
class SceneDelegate: UIResponder, UIWindowSceneDelegate {
  var window: UIWindow?

  func scene(
    _ scene: UIScene,
    willConnectTo session: UISceneSession,
    options connectionOptions: UIScene.ConnectionOptions
  ) {
    guard let windowScene = scene as? UIWindowScene,
          let appDelegate = UIApplication.shared.delegate as? AppDelegate,
          let factory = appDelegate.reactNativeFactory else { return }

    let window = UIWindow(windowScene: windowScene)
    self.window = window
    appDelegate.window = window

    // Linking.getInitialURL() lee la URL de los launchOptions; con escenas
    // viene en connectionOptions, así que se pasa a mano.
    var launchOptions: [UIApplication.LaunchOptionsKey: Any] = [:]
    if let url = connectionOptions.urlContexts.first?.url {
      launchOptions[.url] = url
    }
    if let activity = connectionOptions.userActivities.first {
      launchOptions[.userActivityDictionary] = [
        "UIApplicationLaunchOptionsUserActivityTypeKey": activity.activityType,
        "UIApplicationLaunchOptionsUserActivityKey": activity,
      ]
    }

    factory.startReactNative(
      withModuleName: "main",
      in: window,
      launchOptions: launchOptions.isEmpty ? nil : launchOptions)
  }

  func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
    guard let appDelegate = UIApplication.shared.delegate as? AppDelegate else { return }
    for context in URLContexts {
      var options: [UIApplication.OpenURLOptionsKey: Any] = [:]
      if let source = context.options.sourceApplication {
        options[.sourceApplication] = source
      }
      _ = appDelegate.application(UIApplication.shared, open: context.url, options: options)
    }
  }

  func scene(_ scene: UIScene, continue userActivity: NSUserActivity) {
    guard let appDelegate = UIApplication.shared.delegate as? AppDelegate else { return }
    _ = appDelegate.application(UIApplication.shared, continue: userActivity, restorationHandler: { _ in })
  }
}
// @generated end withUIScene
`;

const OLD_WINDOW = '    window = UIWindow(frame: UIScreen.main.bounds)\n';
const OLD_START = /    factory\.startReactNative\(\n      withModuleName: "main",\n      in: window,\n      launchOptions: launchOptions\)\n/;

// Exportada aparte para poder aplicarla a un ios/ ya generado sin correr prebuild.
function addSceneDelegate(src) {
  if (src.includes('class SceneDelegate')) return src;
  if (!src.includes(OLD_WINDOW) || !OLD_START.test(src)) {
    throw new Error(
      'withUIScene: AppDelegate.swift no tiene la forma esperada (Expo 54). ' +
      'Revisar el plugin antes de compilar para iOS.'
    );
  }
  src = src
    .replace(OLD_WINDOW, '    // La ventana y startReactNative van en SceneDelegate (plugins/withUIScene.js).\n')
    .replace(OLD_START, '');
  return src.trimEnd() + '\n' + SCENE_DELEGATE;
}

function withSceneAppDelegate(config) {
  return withAppDelegate(config, (config) => {
    config.modResults.contents = addSceneDelegate(config.modResults.contents);
    return config;
  });
}

function withSceneManifest(config) {
  return withInfoPlist(config, (config) => {
    config.modResults.UIApplicationSceneManifest = {
      UIApplicationSupportsMultipleScenes: false,
      UISceneConfigurations: {
        UIWindowSceneSessionRoleApplication: [
          {
            UISceneConfigurationName: 'Default Configuration',
            UISceneDelegateClassName: '$(PRODUCT_MODULE_NAME).SceneDelegate',
          },
        ],
      },
    };
    return config;
  });
}

module.exports = function withUIScene(config) {
  return withSceneManifest(withSceneAppDelegate(config));
};
module.exports.addSceneDelegate = addSceneDelegate;
