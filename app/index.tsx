import { useEffect, useState } from "react";
import { View, Text, ActivityIndicator, TouchableOpacity } from "react-native";
import { supabase } from "../lib/supabase";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";

export default function HomeScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkUser();
  }, []);

  const checkUser = async () => {
    const { data } = await supabase.auth.getSession();

    if (!data.session) {
      router.replace("/auth-screen");
    } else {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: "center" }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, padding: 20 }}>
      <Text>Welcome to Home Screen 🎉</Text>

      {/* create class button  */}
      <TouchableOpacity
        style={{
          backgroundColor: "#2563eb",
          paddingVertical: 16,
          borderRadius: 10,
          alignItems: "center",
          position: "absolute",
          bottom: 70,
          left: 20,
          right: 20,
        }}
        onPress={() => router.push("./create/class")}
        activeOpacity={0.85}
      >
        <Text
          style={{
            color: "#fff",
            fontSize: 16,
            fontWeight: "600",
          }}
        >
          Create Class
        </Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}
