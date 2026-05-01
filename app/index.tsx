import { Link } from "expo-router";
import { Text, View } from "react-native";

export default function Index() {
  return (
    <View
      style={{
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      <Text>hello, world!</Text>
      <Link href="/about" style={{ marginTop: 20 }}>
        Go to about page
      </Link>
    </View>
  );
}
