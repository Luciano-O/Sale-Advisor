// With the app killed, Android runs this bundle headless to handle a push and never renders
// app/_layout, so the background task (and TaskManager's headless entry) is registered here first.
import "./src/background-notifications";
import "expo-router/entry";
