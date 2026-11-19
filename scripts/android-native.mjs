/* Adds the small native pieces the Android app needs, after "npx cap add android"
   has made the Android project:
   - picture-in-picture: a tiny plugin ("Pip") and a MainActivity that opens the
     small video window when the person leaves the app while a film plays
   - the app opens in portrait on phones (the player turns to landscape by itself)
   Run from the repository folder: node scripts/android-native.mjs */
import fs from 'node:fs';
import path from 'node:path';

const root = 'android/app/src/main';

function findFile(dir, name) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      const hit = findFile(full, name);
      if (hit) return hit;
    } else if (entry.name === name) {
      return full;
    }
  }
  return null;
}

const mainActivity = findFile(path.join(root, 'java'), 'MainActivity.java');
if (!mainActivity) {
  console.log('MainActivity.java not found, picture-in-picture is skipped');
  process.exit(0);
}

const original = fs.readFileSync(mainActivity, 'utf8');
const pkg = /^\s*package\s+([\w.]+)\s*;/m.exec(original)?.[1];
if (!pkg) {
  console.log('Could not read the package name, picture-in-picture is skipped');
  process.exit(0);
}

const plugin = `package ${pkg};

import android.app.Activity;
import android.app.PictureInPictureParams;
import android.content.pm.PackageManager;
import android.os.Build;
import android.util.Rational;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/* Picture-in-picture for the video player. */
@CapacitorPlugin(name = "Pip")
public class PipPlugin extends Plugin {
    // true while a film is playing: leaving the app then opens the small window
    public static volatile boolean armed = false;

    public static boolean enterNow(Activity activity) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return false;
        try {
            PictureInPictureParams params = new PictureInPictureParams.Builder()
                .setAspectRatio(new Rational(16, 9))
                .build();
            return activity.enterPictureInPictureMode(params);
        } catch (Exception e) {
            return false;
        }
    }

    @PluginMethod
    public void isSupported(PluginCall call) {
        boolean ok = Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
            && getActivity().getPackageManager().hasSystemFeature(PackageManager.FEATURE_PICTURE_IN_PICTURE);
        JSObject result = new JSObject();
        result.put("supported", ok);
        call.resolve(result);
    }

    @PluginMethod
    public void setArmed(PluginCall call) {
        armed = Boolean.TRUE.equals(call.getBoolean("armed", false));
        call.resolve();
    }

    @PluginMethod
    public void enter(final PluginCall call) {
        getActivity().runOnUiThread(new Runnable() {
            @Override
            public void run() {
                JSObject result = new JSObject();
                result.put("entered", enterNow(getActivity()));
                call.resolve(result);
            }
        });
    }
}
`;

const activity = `package ${pkg};

import android.content.res.Configuration;
import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        registerPlugin(PipPlugin.class);
        super.onCreate(savedInstanceState);
    }

    @Override
    protected void onUserLeaveHint() {
        super.onUserLeaveHint();
        if (PipPlugin.armed) PipPlugin.enterNow(this);
    }

    @Override
    public void onPictureInPictureModeChanged(boolean isInPictureInPictureMode, Configuration newConfig) {
        super.onPictureInPictureModeChanged(isInPictureInPictureMode, newConfig);
        if (getBridge() != null && getBridge().getWebView() != null) {
            getBridge().getWebView().evaluateJavascript(
                "window.dispatchEvent(new CustomEvent('nexushd:pip',{detail:" + isInPictureInPictureMode + "}))",
                null
            );
        }
    }
}
`;

fs.writeFileSync(path.join(path.dirname(mainActivity), 'PipPlugin.java'), plugin);
fs.writeFileSync(mainActivity, activity);
console.log('Wrote PipPlugin.java and MainActivity.java in package', pkg);

// the manifest: allow the small window, start in portrait
const manifestFile = path.join(root, 'AndroidManifest.xml');
let xml = fs.readFileSync(manifestFile, 'utf8');
xml = xml.replace(/<activity\b[^>]*>/, (tag) => {
  let next = tag;
  const add = (name, value) => {
    if (!next.includes(`android:${name}=`)) next = next.replace('<activity', `<activity android:${name}="${value}"`);
  };
  add('supportsPictureInPicture', 'true');
  add('screenOrientation', 'portrait');
  // the activity must handle these changes itself, or the window restarts in picture-in-picture
  const needed = ['orientation', 'screenSize', 'smallestScreenSize', 'screenLayout'];
  const match = /android:configChanges="([^"]*)"/.exec(next);
  if (match) {
    const have = match[1].split('|');
    const all = [...new Set([...have, ...needed])];
    next = next.replace(match[0], `android:configChanges="${all.join('|')}"`);
  } else {
    next = next.replace('<activity', `<activity android:configChanges="${needed.join('|')}"`);
  }
  return next;
});
fs.writeFileSync(manifestFile, xml);
console.log(/<activity\b[^>]*>/.exec(xml)?.[0]);
