import React from "react";

import {
  Body,
  Head,
  Html,
  Link,
  Preview,
  Tailwind,
  Text,
} from "@react-email/components";

interface ThousandViewsCongratsEmailProps {
  name: string | null | undefined;
}

const ThousandViewsCongratsEmail = ({
  name,
}: ThousandViewsCongratsEmailProps) => {
  return (
    <Html>
      <Head />
      <Preview>1000 views on DocRoom!</Preview>
      <Tailwind>
        <Body className="font-sans text-sm">
          <Text>Hi{name && ` ${name}`},</Text>
          <Text>
            Congratulations on reaching 1000 views on your documents with
            DocRoom!
          </Text>
          <Text>How has your experience been so far?</Text>

          <Text>
            Thanks,
            <br />
            The DocRoom Team
          </Text>
        </Body>
      </Tailwind>
    </Html>
  );
};

export default ThousandViewsCongratsEmail;
