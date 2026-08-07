import { Image, type ImageStyle, type StyleProp } from "react-native";

type AtlasLogoProps = {
  width?: number;
  style?: StyleProp<ImageStyle>;
  dark?: boolean;
  office?: boolean;
};

const ASPECT_RATIO = 904 / 257;
const LOGO_URL = "https://www.atlas-one.co/atlas-one-logo-dark.png";

export function AtlasLogo({ width = 166, style }: AtlasLogoProps) {
  return (
    <Image
      source={{ uri: LOGO_URL }}
      style={[{ width, height: width / ASPECT_RATIO, resizeMode: "contain" }, style]}
      accessibilityRole="image"
      accessibilityLabel="Atlas One"
    />
  );
}
