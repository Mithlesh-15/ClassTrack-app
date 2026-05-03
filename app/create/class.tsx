import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ScrollView,
} from "react-native";
import { supabase } from "../../lib/supabase";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import DateTimePicker from "@react-native-community/datetimepicker";

type Student = {
  id: number;
  name: string;
};

export default function CreateClass() {
  const router = useRouter();

  const [className, setClassName] = useState("");
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [showPicker, setShowPicker] = useState(false);
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(false);

  const addStudent = () => {
    setStudents((prev) => [...prev, { id: Date.now(), name: "" }]);
  };

  const updateStudent = (id: number, value: string) => {
    setStudents((prev) =>
      prev.map((s) => (s.id === id ? { ...s, name: value } : s)),
    );
  };

  const removeStudent = (id: number) => {
    setStudents((prev) => prev.filter((s) => s.id !== id));
  };

  // 🧠 validation
  const validate = () => {
    if (!className.trim()) {
      Alert.alert("Error", "Class name required");
      return false;
    }

    if (!startDate) {
      Alert.alert("Error", "Select start date");
      return false;
    }

    const invalidStudent = students.find(
      (s) => !s.name || s.name.trim() === "",
    );

    if (invalidStudent) {
      Alert.alert("Error", "Student name cannot be empty");
      return false;
    }

    return true;
  };

  const handleCreate = async () => {
    if (!validate()) return;

    try {
      setLoading(true);

      const { data: userData } = await supabase.auth.getUser();
      const user = userData.user;

      if (!user) throw new Error("User not logged in");

      // 🟢 insert class
      const { data: classData, error: classError } = await supabase
        .from("classes")
        .insert([
          {
            name: className,
            start_date: startDate?.toISOString().split("T")[0],
            teacher_id: user.id,
          },
        ])
        .select()
        .single();

      if (classError) throw classError;

      // 🟢 insert students
      if (students.length > 0) {
        const studentData = students.map((s) => ({
          name: s.name,
          class_id: classData.id,
        }));

        const { error: studentError } = await supabase
          .from("students")
          .insert(studentData);

        if (studentError) throw studentError;
      }

      Alert.alert("Success", "Class created successfully 🎉");

      router.replace("/");
    } catch (error: any) {
      console.log("ERROR:", error);

      Alert.alert(
        "Error",
        error?.message || "Something went wrong. Try again.",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView>
        <Text style={styles.title}>Create Class</Text>

        <TextInput
          placeholder="Class Name"
          value={className}
          onChangeText={setClassName}
          style={styles.input}
        />

        {/* 📅 Date Picker */}
        <TouchableOpacity
          style={styles.input}
          onPress={() => setShowPicker(true)}
        >
          <Text>
            {startDate ? startDate.toDateString() : "Select Start Date Of Class"}
          </Text>
        </TouchableOpacity>

        {showPicker && (
          <DateTimePicker
            value={startDate || new Date()}
            mode="date"
            display="default"
            onChange={(_, selectedDate) => {
              setShowPicker(false);
              if (selectedDate) setStartDate(selectedDate);
            }}
          />
        )}

        <Text style={styles.subTitle}>Students</Text>

        {students.map((student) => (
          <View key={student.id} style={styles.studentRow}>
            <TextInput
              placeholder="Student Name"
              value={student.name}
              onChangeText={(text) => updateStudent(student.id, text)}
              style={styles.studentInput}
            />

            <TouchableOpacity onPress={() => removeStudent(student.id)}>
              <Text style={styles.delete}>✕</Text>
            </TouchableOpacity>
          </View>
        ))}

        <TouchableOpacity style={styles.addBtn} onPress={addStudent}>
          <Text style={styles.addText}>+ Add Student</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.createBtn, loading && { opacity: 0.6 }]}
          onPress={handleCreate}
          disabled={loading}
        >
          <Text style={styles.createText}>
            {loading ? "Creating..." : "Create Class"}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20 },
  title: { fontSize: 22, marginBottom: 20, fontWeight: "600" },
  subTitle: { marginTop: 20, marginBottom: 10, fontWeight: "500" },
  input: {
    borderWidth: 1,
    padding: 12,
    borderRadius: 8,
    marginBottom: 10,
  },
  studentRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
  },
  studentInput: {
    flex: 1,
    borderWidth: 1,
    padding: 10,
    borderRadius: 8,
    marginRight: 10,
  },
  delete: {
    color: "red",
    fontSize: 18,
  },
  addBtn: {
    backgroundColor: "#eee",
    padding: 12,
    borderRadius: 8,
    marginTop: 10,
  },
  addText: {
    textAlign: "center",
    fontWeight: "500",
  },
  createBtn: {
    backgroundColor: "#2563eb",
    padding: 15,
    borderRadius: 10,
    marginTop: 30,
  },
  createText: {
    color: "#fff",
    textAlign: "center",
    fontWeight: "600",
  },
});
