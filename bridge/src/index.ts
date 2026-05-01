import "dotenv/config";
import mqtt from "mqtt";
import { createClient } from "@supabase/supabase-js";

const mqttBrokerUrl = process.env.MQTT_BROKER_URL || "mqtt://localhost:1883";
const mqttUsername = process.env.MQTT_USERNAME;
const mqttPassword = process.env.MQTT_PASSWORD;
const mqttTopic = process.env.MQTT_TOPIC || "sensors/+/data";
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const supabaseTable = process.env.SUPABASE_TABLE || "mqtt_data";

if (!supabaseUrl || !supabaseKey) {
  throw new Error("SUPABASE_URL and SUPABASE_KEY environment variables are required");
}

const supabase = createClient(supabaseUrl, supabaseKey);

const mqttClient = mqtt.connect(mqttBrokerUrl, {
  username: mqttUsername,
  password: mqttPassword,
});

mqttClient.on("connect", () => {
  console.log(`Connected to MQTT broker: ${mqttBrokerUrl}`);
  mqttClient.subscribe(mqttTopic, (err) => {
    if (err) {
      console.error(`Failed to subscribe to ${mqttTopic}:`, err);
    } else {
      console.log(`Subscribed to topic: ${mqttTopic}`);
    }
  });
});

mqttClient.on("message", async (topic, message) => {
  try {
    const payload = JSON.parse(message.toString());
    
    const record = {
      topic,
      payload,
      received_at: new Date().toISOString(),
    };

    const { error } = await supabase
      .from(supabaseTable)
      .insert([record]);

    if (error) {
      console.error(`Failed to insert data into ${supabaseTable}:`, error);
    } else {
      console.log(`Data inserted from topic ${topic}:`, record);
    }
  } catch (err) {
    console.error("Error processing MQTT message:", err);
  }
});

mqttClient.on("error", (err) => {
  console.error("MQTT connection error:", err);
});

mqttClient.on("offline", () => {
  console.log("MQTT client offline");
});

console.log("MQTT listener started. Waiting for messages...");
