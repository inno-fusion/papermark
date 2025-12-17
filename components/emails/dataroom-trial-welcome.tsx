import React from "react";

import { Body, Head, Html, Tailwind, Text } from "@react-email/components";

interface WelcomeEmailProps {
  name: string | null | undefined;
}

const DataroomTrialWelcomeEmail = ({ name }: WelcomeEmailProps) => {
  return (
    <Html>
      <Head />
      <Tailwind>
        <Body className="font-sans text-sm">
          <Text>Hi{name && ` ${name}`},</Text>
          <Text>
            Thanks for starting your DocRoom trial! Do you need any help with
            Data Rooms setup?
          </Text>
          <Text>The DocRoom Team</Text>
        </Body>
      </Tailwind>
    </Html>
  );
};

export default DataroomTrialWelcomeEmail;
