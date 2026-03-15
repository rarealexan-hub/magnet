import { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.trymagnetapp.app",
  appName: "Magnet",
  webDir: "dist/public",
  server: {
    url: "https://trymagnetapp.com",
    cleartext: false,
  },
  ios: {
    contentInset: "always",
    backgroundColor: "#09090b",
  },
};

export default config;
