import CharacterStage from "@/components/CharacterStage";
import { araPoseSrc, type AraPose } from "@/lib/araPoses";

type Props = {
  girlPose?: AraPose;
  boyPose?: AraPose;
  size?: number;
};

/** Always shows both Aras on auth screens — ignores saved gender prefs. */
export default function AuthAraPair({
  girlPose = "wink",
  boyPose = "wave",
  size = 96,
}: Props) {
  return (
    <div className="flex items-end justify-center gap-1 sm:gap-2">
      <CharacterStage
        size={size}
        pose={girlPose}
        priority
        pad="md"
        label="Girl Ara"
        gender="girl"
        lookSrc={araPoseSrc("girl", girlPose)}
      />
      <CharacterStage
        size={size}
        pose={boyPose}
        priority
        pad="md"
        label="Boy Ara"
        gender="boy"
        lookSrc={araPoseSrc("boy", boyPose)}
      />
    </div>
  );
}
