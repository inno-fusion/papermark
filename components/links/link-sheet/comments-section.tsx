import { useEffect, useState } from "react";

import { DEFAULT_LINK_TYPE } from ".";
import LinkItem from "./link-item";

export default function CommentsSection({
  data,
  setData,
}: {
  data: DEFAULT_LINK_TYPE;
  setData: React.Dispatch<React.SetStateAction<DEFAULT_LINK_TYPE>>;
}) {
  const { enableComments } = data;
  const [enabled, setEnabled] = useState<boolean>(false);

  useEffect(() => {
    setEnabled(enableComments);
  }, [enableComments]);

  const handleEnableComments = () => {
    const updatedEnableComments = !enabled;
    setData({ ...data, enableComments: updatedEnableComments });
    setEnabled(updatedEnableComments);
  };

  return (
    <div className="pb-5">
      <LinkItem
        title="Allow viewers to comment on pages"
        enabled={enabled}
        tooltipContent="Viewers can click on document pages to leave comments visible to all viewers. Requires email protection to be enabled."
        action={handleEnableComments}
      />
    </div>
  );
}
