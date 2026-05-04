import { useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { supabase } from "../../lib/supabase";

type StudentStatus = "present" | "absent";

type Student = {
  id: string;
  name: string;
  status?: StudentStatus;
};

type StudentRow = {
  id: string | number;
  name: string;
};

type AttendanceRow = {
  id: string | number;
  date: string;
};

type AttendanceRecordRow = {
  id: string | number;
  student_id: string | number;
  status: StudentStatus;
};

const getTodayDate = () => new Date().toISOString().split("T")[0];

export default function ClassDetailScreen() {
  const { class_id } = useLocalSearchParams<{
    class_id?: string | string[];
  }>();

  const classId = Array.isArray(class_id) ? class_id[0] : class_id;
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedDate, setSelectedDate] = useState<string>(getTodayDate());
  const [availableDates, setAvailableDates] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hasMarkedStudents = useMemo(
    () => students.some((student) => student.status),
    [students],
  );

  const fetchStudents = useCallback(async (): Promise<Student[]> => {
    if (!classId) {
      return [];
    }

    const { data, error: studentsError } = await supabase
      .from("students")
      .select("id, name")
      .eq("class_id", classId)
      .order("name", { ascending: true });

    if (studentsError) {
      throw studentsError;
    }

    return ((data ?? []) as StudentRow[]).map((student) => ({
      id: String(student.id),
      name: student.name,
      status: undefined,
    }));
  }, [classId]);

  const fetchAvailableDates = useCallback(async () => {
    if (!classId) {
      return;
    }

    const { data, error: attendanceDatesError } = await supabase
      .from("attendance")
      .select("date")
      .eq("class_id", classId)
      .order("date", { ascending: false })
      .limit(3);

    if (attendanceDatesError) {
      throw attendanceDatesError;
    }

    const dates = ((data ?? []) as Pick<AttendanceRow, "date">[]).map(
      (row) => row.date,
    );

    setAvailableDates(dates);
  }, [classId]);

  const loadAttendance = useCallback(
    async (date: string) => {
      if (!classId) {
        setError("Class id is missing.");
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setSelectedDate(date);

        const baseStudents = await fetchStudents();

        const { data: existingAttendance, error: attendanceError } =
          await supabase
            .from("attendance")
            .select("id, date")
            .eq("class_id", classId)
            .eq("date", date)
            .maybeSingle();

        if (attendanceError) {
          throw attendanceError;
        }

        if (!existingAttendance) {
          setStudents(baseStudents);
          setError(null);
          return;
        }

        const { data: attendanceRecords, error: attendanceRecordsError } =
          await supabase
            .from("attendance_records")
            .select("student_id, status")
            .eq("attendance_id", existingAttendance.id);

        if (attendanceRecordsError) {
          throw attendanceRecordsError;
        }

        const recordMap = new Map<string, StudentStatus>(
          ((attendanceRecords ?? []) as AttendanceRecordRow[]).map((record) => [
            String(record.student_id),
            record.status,
          ]),
        );

        const mergedStudents = baseStudents.map((student) => ({
          ...student,
          status: recordMap.get(student.id),
        }));

        setStudents(mergedStudents);
        setError(null);
      } catch (err) {
        const message =
          err instanceof Error
            ? err.message
            : "We couldn't load attendance right now.";

        setError(message);
        setStudents([]);
      } finally {
        setLoading(false);
      }
    },
    [classId, fetchStudents],
  );

  useEffect(() => {
    let isMounted = true;

    const initializeScreen = async () => {
      if (!classId) {
        if (isMounted) {
          setError("Class id is missing.");
          setLoading(false);
        }
        return;
      }

      const today = getTodayDate();

      try {
        setLoading(true);
        setSelectedDate(today);
        await fetchAvailableDates();

        if (!isMounted) {
          return;
        }

        await loadAttendance(today);
      } catch (err) {
        if (!isMounted) {
          return;
        }

        const message =
          err instanceof Error
            ? err.message
            : "We couldn't initialize attendance.";

        setError(message);
        setStudents([]);
        setLoading(false);
      }
    };

    void initializeScreen();

    return () => {
      isMounted = false;
    };
  }, [classId, fetchAvailableDates, loadAttendance]);

  const updateStudentStatus = (studentId: string, status: StudentStatus) => {
    setStudents((currentStudents) =>
      currentStudents.map((student) =>
        student.id === studentId ? { ...student, status } : student,
      ),
    );
  };

  const handleSelectDate = (date: string) => {
    void loadAttendance(date);
  };

  const dateOptions = useMemo(() => {
    const today = getTodayDate();
    const uniqueDates = Array.from(
      new Set([today, ...availableDates.filter(Boolean)]),
    );

    return uniqueDates.map((date) => ({
      value: date,
      label: date === today ? "Today" : date,
    }));
  }, [availableDates]);

  const saveAttendance = async () => {
    if (!classId || !hasMarkedStudents) {
      return;
    }

    const markedStudents = students.filter(
      (student): student is Student & { status: StudentStatus } =>
        student.status === "present" || student.status === "absent",
    );

    try {
      setSaving(true);

      const { data: existingAttendance, error: attendanceFetchError } =
        await supabase
          .from("attendance")
          .select("id")
          .eq("class_id", classId)
          .eq("date", selectedDate)
          .maybeSingle();

      if (attendanceFetchError) {
        throw attendanceFetchError;
      }

      let attendanceId = existingAttendance?.id;

      if (!attendanceId) {
        const { data: insertedAttendance, error: attendanceInsertError } =
          await supabase
            .from("attendance")
            .insert([
              {
                class_id: classId,
                date: selectedDate,
              },
            ])
            .select("id")
            .single();

        if (attendanceInsertError) {
          throw attendanceInsertError;
        }

        attendanceId = insertedAttendance.id;
      }

      const { data: existingRecords, error: recordsFetchError } = await supabase
        .from("attendance_records")
        .select("id, student_id")
        .eq("attendance_id", attendanceId);

      if (recordsFetchError) {
        throw recordsFetchError;
      }

      const existingRecordMap = new Map<string, string>(
        ((existingRecords ?? []) as AttendanceRecordRow[]).map((record) => [
          String(record.student_id),
          String(record.id),
        ]),
      );

      await Promise.all(
        markedStudents.map(async (student) => {
          const existingRecordId = existingRecordMap.get(student.id);

          if (existingRecordId) {
            const { error: updateError } = await supabase
              .from("attendance_records")
              .update({
                status: student.status,
              })
              .eq("id", existingRecordId);

            if (updateError) {
              throw updateError;
            }

            return;
          }

          const { error: insertError } = await supabase
            .from("attendance_records")
            .insert([
              {
                attendance_id: attendanceId,
                student_id: student.id,
                status: student.status,
              },
            ]);

          if (insertError) {
            throw insertError;
          }
        }),
      );

      await fetchAvailableDates();
      await loadAttendance(selectedDate);
      Alert.alert("Success", "Attendance saved successfully");
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "We couldn't save attendance right now.";

      Alert.alert("Error", message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.container} edges={["top", "left", "right"]}>
        <View style={styles.centered}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["top", "left", "right"]}>
      <View style={styles.header}>
        <Text style={styles.title}>Class Attendance</Text>
        <Text style={styles.subtitle}>
          Choose a date, mark students, and save attendance.
        </Text>
      </View>

      <View style={styles.dateSection}>
        <Text style={styles.sectionLabel}>Attendance Date</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.dateOptionsRow}
        >
          {dateOptions.map((option) => {
            const isSelected = option.value === selectedDate;

            return (
              <Pressable
                key={option.value}
                style={[
                  styles.dateChip,
                  isSelected && styles.dateChipSelected,
                ]}
                onPress={() => handleSelectDate(option.value)}
              >
                <Text
                  style={[
                    styles.dateChipText,
                    isSelected && styles.dateChipTextSelected,
                  ]}
                >
                  {option.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
        <Text style={styles.selectedDateText}>Selected: {selectedDate}</Text>
      </View>

      <FlatList
        data={students}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[
          styles.listContent,
          students.length === 0 && styles.emptyListContent,
        ]}
        renderItem={({ item }) => {
          const isPresent = item.status === "present";
          const isAbsent = item.status === "absent";

          return (
            <View style={styles.card}>
              <Text style={styles.studentName}>{item.name}</Text>

              <View style={styles.actionsRow}>
                <Pressable
                  style={[
                    styles.statusButton,
                    styles.presentButton,
                    isPresent && styles.presentButtonActive,
                  ]}
                  onPress={() => updateStudentStatus(item.id, "present")}
                >
                  <Text
                    style={[
                      styles.statusButtonText,
                      isPresent && styles.statusButtonTextActive,
                    ]}
                  >
                    Present
                  </Text>
                </Pressable>

                <Pressable
                  style={[
                    styles.statusButton,
                    styles.absentButton,
                    isAbsent && styles.absentButtonActive,
                  ]}
                  onPress={() => updateStudentStatus(item.id, "absent")}
                >
                  <Text
                    style={[
                      styles.statusButtonText,
                      isAbsent && styles.statusButtonTextActive,
                    ]}
                  >
                    Absent
                  </Text>
                </Pressable>
              </View>
            </View>
          );
        }}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>No students found</Text>
          </View>
        }
      />

      <View style={styles.footer}>
        <Pressable
          style={[
            styles.saveButton,
            (!hasMarkedStudents || saving) && styles.saveButtonDisabled,
          ]}
          onPress={() => {
            void saveAttendance();
          }}
          disabled={!hasMarkedStudents || saving}
        >
          {saving ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <Text style={styles.saveButtonText}>Save Attendance</Text>
          )}
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8fafc",
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8,
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    color: "#0f172a",
  },
  subtitle: {
    marginTop: 6,
    fontSize: 14,
    color: "#64748b",
  },
  dateSection: {
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#334155",
    marginBottom: 10,
  },
  dateOptionsRow: {
    gap: 10,
    paddingRight: 20,
  },
  dateChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    backgroundColor: "#ffffff",
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  dateChipSelected: {
    backgroundColor: "#2563eb",
    borderColor: "#2563eb",
  },
  dateChipText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#334155",
  },
  dateChipTextSelected: {
    color: "#ffffff",
  },
  selectedDateText: {
    marginTop: 10,
    fontSize: 13,
    color: "#64748b",
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 120,
    gap: 12,
  },
  emptyListContent: {
    flexGrow: 1,
    justifyContent: "center",
  },
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  studentName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#0f172a",
    marginBottom: 14,
  },
  actionsRow: {
    flexDirection: "row",
    gap: 10,
  },
  statusButton: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  presentButton: {
    backgroundColor: "#f0fdf4",
    borderColor: "#86efac",
  },
  presentButtonActive: {
    backgroundColor: "#16a34a",
    borderColor: "#16a34a",
  },
  absentButton: {
    backgroundColor: "#fef2f2",
    borderColor: "#fca5a5",
  },
  absentButtonActive: {
    backgroundColor: "#dc2626",
    borderColor: "#dc2626",
  },
  statusButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#0f172a",
  },
  statusButtonTextActive: {
    color: "#ffffff",
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
  },
  emptyText: {
    fontSize: 15,
    color: "#64748b",
    textAlign: "center",
  },
  footer: {
    position: "absolute",
    left: 20,
    right: 20,
    bottom: 24,
  },
  saveButton: {
    minHeight: 56,
    backgroundColor: "#2563eb",
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#2563eb",
    shadowOpacity: 0.2,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  saveButtonDisabled: {
    opacity: 0.55,
  },
  saveButtonText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "700",
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
    backgroundColor: "#f8fafc",
  },
  errorText: {
    fontSize: 15,
    lineHeight: 22,
    textAlign: "center",
    color: "#b91c1c",
  },
});
