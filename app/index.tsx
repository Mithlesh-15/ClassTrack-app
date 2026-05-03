import { Redirect, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { supabase } from "../lib/supabase";

type ClassItem = {
  id: string;
  name: string;
  start_date: string | null;
};

export default function HomeScreen() {
  const router = useRouter();
  const [sessionChecked, setSessionChecked] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const initializeHome = async () => {
      try {
        const {
          data: { session },
          error: sessionError,
        } = await supabase.auth.getSession();

        if (sessionError) {
          throw sessionError;
        }

        if (!isMounted) {
          return;
        }

        if (!session?.user) {
          setIsAuthenticated(false);
          setSessionChecked(true);
          setLoading(false);
          return;
        }

        setIsAuthenticated(true);
        setSessionChecked(true);

        const { data, error: classesError } = await supabase
          .from("classes")
          .select("id, name, start_date")
          .eq("teacher_id", session.user.id)
          .order("created_at", { ascending: false });

        if (classesError) {
          throw classesError;
        }

        if (!isMounted) {
          return;
        }

        setClasses((data ?? []) as ClassItem[]);
        setError(null);
      } catch (err) {
        if (!isMounted) {
          return;
        }

        const message =
          err instanceof Error
            ? err.message
            : "We couldn't load your classes right now.";

        setError(message);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    initializeHome();

    return () => {
      isMounted = false;
    };
  }, []);

  const formatStartDate = (date: string | null) => {
    if (!date) {
      return "Start date not set";
    }

    const parsedDate = new Date(date);

    if (Number.isNaN(parsedDate.getTime())) {
      return date;
    }

    return parsedDate.toLocaleDateString("en-US", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  const deleteClass = async (classId: string) => {
    const previousClasses = classes;

    try {
      setClasses((currentClasses) =>
        currentClasses.filter((item) => item.id !== classId),
      );

      const { error: deleteError } = await supabase
        .from("classes")
        .delete()
        .eq("id", classId);

      if (deleteError) {
        throw deleteError;
      }

      Alert.alert("Class deleted");
    } catch (err) {
      setClasses(previousClasses);

      const message =
        err instanceof Error
          ? err.message
          : "Unable to delete the class right now.";

      Alert.alert("Delete failed", message);
    }
  };

  const confirmDeleteClass = (classId: string) => {
    Alert.alert(
      "Delete Class",
      "Are you sure you want to delete this class?",
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            void deleteClass(classId);
          },
        },
      ],
    );
  };

  if (!sessionChecked || loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    );
  }

  if (!isAuthenticated) {
    return <Redirect href="/auth-screen" />;
  }

  return (
    <SafeAreaView style={styles.container} edges={["top", "left", "right"]}>
      <View style={styles.header}>
        <Text style={styles.title}>My Classes</Text>
      </View>

      {error ? (
        <View style={styles.centered}>
          <Text style={styles.errorText}>
            We hit a snag while loading your classes. {error}
          </Text>
        </View>
      ) : (
        <FlatList
          data={classes}
          keyExtractor={(item) => item.id}
          style={styles.list}
          contentContainerStyle={[
            styles.listContent,
            classes.length === 0 && styles.emptyListContent,
          ]}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <Pressable
              style={styles.card}
              onPress={() =>
                router.push({
                  pathname: "/Class/[class_id]",
                  params: { class_id: item.id },
                })
              }
              onLongPress={() => confirmDeleteClass(item.id)}
              delayLongPress={250}
            >
              <Text style={styles.className}>{item.name}</Text>
              <Text style={styles.classDate}>
                Starts {formatStartDate(item.start_date)}
              </Text>
            </Pressable>
          )}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>
                No classes yet. Create your first class.
              </Text>
            </View>
          }
        />
      )}

      <Pressable
        style={styles.createButton}
        onPress={() => router.push("/create/class")}
      >
        <Text style={styles.createButtonText}>+ Create Class</Text>
      </Pressable>
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
    paddingBottom: 12,
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    color: "#0f172a",
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: 20,
    paddingTop: 8,
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
    padding: 18,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    shadowColor: "#0f172a",
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  className: {
    fontSize: 17,
    fontWeight: "700",
    color: "#0f172a",
    marginBottom: 6,
  },
  classDate: {
    fontSize: 13,
    color: "#64748b",
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
  },
  emptyText: {
    fontSize: 15,
    lineHeight: 22,
    textAlign: "center",
    color: "#64748b",
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
  createButton: {
    position: "absolute",
    left: 20,
    right: 20,
    bottom: 75,
    backgroundColor: "#2563eb",
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#2563eb",
    shadowOpacity: 0.2,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  createButtonText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "700",
  },
});
