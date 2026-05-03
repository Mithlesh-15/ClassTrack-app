import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
} from "react-native";
import { supabase } from "../../lib/supabase";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";

// 🧠 Student type
type Student = {
  id: number;
  name: string;
};

export default function CreateClass() {
  const router = useRouter();

  const [className, setClassName] = useState<string>("");
  const [startDate, setStartDate] = useState<string>("");
  const [students, setStudents] = useState<Student[]>([]);

  // ➕ Add student
  const addStudent = () => {
    setStudents((prev) => [...prev, { id: Date.now(), name: "" }]);
  };

  // ✏️ Update student
  const updateStudent = (id: number, value: string) => {
    setStudents((prev) =>
      prev.map((s) => (s.id === id ? { ...s, name: value } : s)),
    );
  };

  // ❌ Remove student
  const removeStudent = (id: number) => {
    setStudents((prev) => prev.filter((s) => s.id !== id));
  };

  // 🚀 Create class
  const handleCreate = async () => {
    
    if (!className || !startDate) {
      alert("Fill all fields");
      return;
    }

    // 🔑 get user
    const { data: userData } = await supabase.auth.getUser();
    const user = userData.user;

    if (!user) {
      alert("User not found");
      return;
    }

    // 1️⃣ Insert class
    const { data: classData, error: classError } = await supabase
      .from("classes")
      .insert([
        {
          name: className,
          start_date: startDate,
          teacher_id: user.id,
        },
      ])
      .select()
      .single();

    if (classError) {
      alert(classError.message);
      return;
    }

    // 2️⃣ Insert students
    const validStudents = students.filter((s) => s.name.trim() !== "");

    if (validStudents.length > 0) {
      const studentData = validStudents.map((s) => ({
        name: s.name,
        class_id: classData.id,
      }));

      const { error: studentError } = await supabase
        .from("students")
        .insert(studentData);

      if (studentError) {
        alert(studentError.message);
        return;
      }
    }

    alert("Class created 🎉");

    router.replace("/");
  };

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Create Class</Text>

      <TextInput
        placeholder="Class Name"
        value={className}
        onChangeText={setClassName}
        style={styles.input}
      />

      <TextInput
        placeholder="Start Date (YYYY-MM-DD)"
        value={startDate}
        onChangeText={setStartDate}
        style={styles.input}
        keyboardType="decimal-pad"
      />

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
            <Text style={{ color: "red", fontSize: 18 }}>✕</Text>
          </TouchableOpacity>
        </View>
      ))}

      <TouchableOpacity style={styles.addBtn} onPress={addStudent}>
        <Text style={{ textAlign: "center" }}>+ Add Student</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.createBtn} onPress={handleCreate}>
        <Text style={{ color: "#fff", textAlign: "center" }}>Create Class</Text>
      </TouchableOpacity>
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
  addBtn: {
    backgroundColor: "#eee",
    padding: 12,
    borderRadius: 8,
    marginTop: 10,
  },
  createBtn: {
    backgroundColor: "#2563eb",
    padding: 15,
    borderRadius: 10,
    marginTop: 30,
  },
});
