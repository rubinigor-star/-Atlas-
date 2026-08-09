import { Image, type ImageStyle, type StyleProp } from "react-native";
import { atlasLogoUri } from "@/lib/atlas-brand";

type AtlasLogoProps = {
  width?: number;
  style?: StyleProp<ImageStyle>;
  dark?: boolean;
  office?: boolean;
};

const ASPECT_RATIO = 904 / 257;

export function AtlasLogo({ width = 166, style }: AtlasLogoProps) {
  return (
    <Image
      source={{ uri: atlasLogoUri }}
      style={[{ width, height: width / ASPECT_RATIO, resizeMode: "contain" }, style]}
      accessibilityRole="image"
      accessibilityLabel="Atlas One"
    />
  );
}
