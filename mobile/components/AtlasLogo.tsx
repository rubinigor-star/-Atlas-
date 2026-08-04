import { Image, type ImageStyle, type StyleProp } from "react-native";
import { atlasLogoUri } from "@/lib/atlas-brand";

type AtlasLogoProps = {
  width?: number;
  style?: StyleProp<ImageStyle>;
  dark?: boolean;
  office?: boolean;
};

const OFFICIAL_LOGO_ASPECT_RATIO = 226 / 64;

export function AtlasLogo({ width = 166, style }: AtlasLogoProps) {
  return (
    <Image
      source={{ uri: atlasLogoUri }}
      style={[
        {
          width,
          height: width / OFFICIAL_LOGO_ASPECT_RATIO,
          resizeMode: "contain",
        },
        style,
      ]}
      accessibilityRole="image"
      accessibilityLabel="Atlas One"
    />
  );
}
