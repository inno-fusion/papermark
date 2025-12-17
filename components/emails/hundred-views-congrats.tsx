import {
  Body,
  Head,
  Html,
  Link,
  Tailwind,
  Text,
} from "@react-email/components";

interface HundredViewsCongratsEmailProps {
  name: string | null | undefined;
}

const HundredViewsCongratsEmail = ({
  name,
}: HundredViewsCongratsEmailProps) => {
  return (
    <Html>
      <Head />
      <Tailwind>
        <Body className="font-sans text-sm">
          <Text>Hi{name && ` ${name}`},</Text>
          <Text>
            Congratulations on reaching 100 views on your documents with
            DocRoom!
          </Text>
          <Text>
            We&apos;re excited to see your documents getting engagement. Keep
            sharing!
          </Text>
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

export default HundredViewsCongratsEmail;
