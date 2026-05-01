import { useState, useEffect } from "react";
import { View, Text, TextInput, TouchableOpacity } from "react-native";
import { supabase } from "../lib/supabase";

export default function LoginScreen({ navigation }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  // 🔥 Check existing session
  useEffect(() => {
    checkUser();
  }, []);

  const checkUser = async () => {
    const { data } = await supabase.auth.getSession();

    if (data.session) {
      navigation.replace("Home");
    }
  };

  // 🔥 Main auth function (login + signup)
  const handleLogin = async () => {
    if (!email || !password) {
      alert("Email and password required");
      return;
    }

    setLoading(true);

    // Step 1: try login
    const { error: loginError } =
      await supabase.auth.signInWithPassword({
        email,
        password,
      });

    if (!loginError) {
      navigation.replace("Home");
      setLoading(false);
      return;
    }

    // Step 2: if login fail → signup
    const { error: signupError } = await supabase.auth.signUp({
      email,
      password,
    });

    if (signupError) {
      alert(signupError.message);
    } else {
      alert("New user created & logged in");
      navigation.replace("Home");
    }

    setLoading(false);
  };

  return (
    <View style={{ flex: 1, justifyContent: "center", padding: 20 }}>
      <Text style={{ fontSize: 24, marginBottom: 20 }}>
        ClassTrack Login
      </Text>

      <TextInput
        placeholder="Email"
        value={email}
        onChangeText={setEmail}
        style={{
          borderWidth: 1,
          padding: 10,
          marginBottom: 10,
          borderRadius: 5,
        }}
      />

      <TextInput
        placeholder="Password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        style={{
          borderWidth: 1,
          padding: 10,
          marginBottom: 20,
          borderRadius: 5,
        }}
      />

      <TouchableOpacity
        onPress={handleLogin}
        style={{
          backgroundColor: "blue",
          padding: 15,
          borderRadius: 5,
        }}
        disabled={loading}
      >
        <Text style={{ color: "#fff", textAlign: "center" }}>
          {loading ? "Please wait..." : "Login"}
        </Text>
      </TouchableOpacity>
    </View>
  );
}