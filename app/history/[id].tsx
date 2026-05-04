import { useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { supabase } from "../../lib/supabase";

type AttendanceStatus = "present" | "absent";

type AttendanceRelation = {
  date: string | null;
};

type AttendanceRecordRow = {
  status: AttendanceStatus;
  attendance: AttendanceRelation | AttendanceRelation[] | null;
};

type AttendanceItem = {
  date: string;
  status: AttendanceStatus;
};

type MonthlyAttendanceGroup = {
  monthKey: string;
  present: number;
  absent: number;
  records: AttendanceItem[];
};

const monthLabelFormatter = new Intl.DateTimeFormat("en-US", {
  month: "long",
  year: "numeric",
});

const dayLabelFormatter = new Intl.DateTimeFormat("en-US", {
  day: "2-digit",
  month: "short",
});

const getMonthKey = (date: string) => date.slice(0, 7);

const parseDate = (date: string) => {
  const parsed = new Date(`${date}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const formatMonthLabel = (monthKey: string) => {
  const parsed = parseDate(`${monthKey}-01`);
  return parsed ? monthLabelFormatter.format(parsed).toUpperCase() : monthKey;
};

const formatDayLabel = (date: string) => {
  const parsed = parseDate(date);
  return parsed ? dayLabelFormatter.format(parsed) : date;
};

const getAttendanceDate = (
  attendance: AttendanceRelation | AttendanceRelation[] | null,
) => {
  if (!attendance) {
    return null;
  }

  if (Array.isArray(attendance)) {
    return attendance[0]?.date ?? null;
  }

  return attendance.date;
};

export default function StudentHistoryScreen() {
  const { id } = useLocalSearchParams<{ id?: string | string[] }>();
  const studentId = Array.isArray(id) ? id[0] : id;

  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceItem[]>(
    [],
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const loadAttendanceHistory = async () => {
      if (!studentId) {
        if (isMounted) {
          setError("Student id is missing.");
          setLoading(false);
        }
        return;
      }

      try {
        setLoading(true);

        const { data, error: attendanceError } = await supabase
          .from("attendance_records")
          .select(`
            status,
            attendance (
              date
            )
          `)
          .eq("student_id", studentId);

        if (attendanceError) {
          throw attendanceError;
        }

        const normalizedRecords = ((data ?? []) as AttendanceRecordRow[])
          .map((record) => {
            const date = getAttendanceDate(record.attendance);

            if (!date) {
              return null;
            }

            return {
              date,
              status: record.status,
            } satisfies AttendanceItem;
          })
          .filter((record): record is AttendanceItem => record !== null)
          .sort((first, second) => first.date.localeCompare(second.date));

        if (!isMounted) {
          return;
        }

        setAttendanceRecords(normalizedRecords);
        setError(null);
      } catch (err) {
        if (!isMounted) {
          return;
        }

        const message =
          err instanceof Error
            ? err.message
            : "We couldn't load attendance history right now.";

        setError(message);
        setAttendanceRecords([]);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    void loadAttendanceHistory();

    return () => {
      isMounted = false;
    };
  }, [studentId]);

  const monthlyGroups = useMemo<MonthlyAttendanceGroup[]>(() => {
    const grouped = new Map<string, MonthlyAttendanceGroup>();

    for (const record of attendanceRecords) {
      const monthKey = getMonthKey(record.date);
      const currentGroup = grouped.get(monthKey) ?? {
        monthKey,
        present: 0,
        absent: 0,
        records: [],
      };

      if (record.status === "present") {
        currentGroup.present += 1;
      } else {
        currentGroup.absent += 1;
      }

      currentGroup.records.push(record);
      grouped.set(monthKey, currentGroup);
    }

    return Array.from(grouped.values())
      .map((group) => ({
        ...group,
        records: [...group.records].sort((first, second) =>
          first.date.localeCompare(second.date),
        ),
      }))
      .sort((first, second) => second.monthKey.localeCompare(first.monthKey));
  }, [attendanceRecords]);

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

  if (monthlyGroups.length === 0) {
    return (
      <SafeAreaView style={styles.container} edges={["top", "left", "right"]}>
        <View style={styles.header}>
          <Text style={styles.title}>Student History</Text>
          <Text style={styles.subtitle}>
            Monthly attendance history grouped from all saved records.
          </Text>
        </View>
        <View style={styles.centered}>
          <Text style={styles.emptyText}>No attendance data found</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["top", "left", "right"]}>
      <View style={styles.header}>
        <Text style={styles.title}>Student History</Text>
        <Text style={styles.subtitle}>
          Monthly attendance history grouped from all saved records.
        </Text>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {monthlyGroups.map((group) => (
          <View key={group.monthKey} style={styles.card}>
            <Text style={styles.monthTitle}>
              {formatMonthLabel(group.monthKey)}
            </Text>

            <View style={styles.summaryRow}>
              <Text style={styles.presentText}>Present: {group.present}</Text>
              <Text style={styles.absentText}>Absent: {group.absent}</Text>
            </View>

            <View style={styles.divider} />

            <View style={styles.recordsList}>
              {group.records.map((record) => {
                const isPresent = record.status === "present";

                return (
                  <View key={`${record.date}-${record.status}`} style={styles.recordRow}>
                    <Text style={styles.recordDate}>
                      {formatDayLabel(record.date)}
                    </Text>
                    <Text
                      style={[
                        styles.recordStatus,
                        isPresent ? styles.presentText : styles.absentText,
                      ]}
                    >
                      {isPresent ? "Present" : "Absent"}
                    </Text>
                  </View>
                );
              })}
            </View>
          </View>
        ))}
      </ScrollView>
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
    lineHeight: 20,
    color: "#64748b",
  },
  scrollView: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 28,
    gap: 14,
  },
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    shadowColor: "#0f172a",
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  monthTitle: {
    fontSize: 18,
    fontWeight: "800",
    letterSpacing: 0.6,
    color: "#0f172a",
  },
  summaryRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    marginTop: 12,
  },
  presentText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#16a34a",
  },
  absentText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#dc2626",
  },
  divider: {
    height: 1,
    backgroundColor: "#e2e8f0",
    marginTop: 14,
    marginBottom: 6,
  },
  recordsList: {
    gap: 10,
  },
  recordRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 6,
    gap: 12,
  },
  recordDate: {
    fontSize: 15,
    fontWeight: "500",
    color: "#334155",
  },
  recordStatus: {
    fontSize: 15,
    fontWeight: "700",
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
    backgroundColor: "#f8fafc",
  },
  emptyText: {
    fontSize: 15,
    lineHeight: 22,
    textAlign: "center",
    color: "#64748b",
  },
  errorText: {
    fontSize: 15,
    lineHeight: 22,
    textAlign: "center",
    color: "#b91c1c",
  },
});
