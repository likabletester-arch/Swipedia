import Constants from "expo-constants";
import { Platform } from "react-native";

import { storage } from "@/src/utils/storage";

export const TOKEN_KEY = "swipedia.session_token";
const backendUrl = String(Constants.expoConfig?.extra?.backendUrl || process.env.EXPO_PUBLIC_BACKEND_URL || "").replace(/\/$/, "");

export type User = {
  user_id: string;
  name: string;
  username: string;
  email: string;
  verified?: boolean;
  avatar?: string;
  bio?: string;
  points: number;
  point_progress: number;
  point_rate: number;
  correct_count: number;
  saved_count: number;
};

export type Question = {
  question_id: string;
  category: string;
  text: string;
  options: string[];
  author_name: string;
  author_username?: string;
  author_id: string;
  author_avatar?: string;
  author_verified?: boolean;
  explanation: string;
  difficulty: string;
  background?: string | null;
  likes: number;
  saves_count: number;
  shares_count: number;
  comments_count: number;
  saved: boolean;
};

export type Comment = { comment_id: string; question_id: string; user_id: string; user_name: string; text: string; created_at: string };
export type Person = { user_id: string; name: string; bio?: string; points?: number; avatar?: string };
export type Message = { message_id: string; sender_id: string; recipient_id: string; sender_name: string; text: string; question_id?: string; created_at: string };
export type Conversation = { participants: string[]; other_name: string; last_message: string; updated_at: string };
export type Leader = { rank: number; user_id: string; name: string; points: number; correct_count: number };

let memoryToken: string | null = null;

export async function getToken() {
  if (memoryToken) return memoryToken;
  memoryToken = await storage.secureGet<string | null>(TOKEN_KEY, null);
  return memoryToken;
}

export async function setToken(token: string) {
  memoryToken = token;
  await storage.secureSet(TOKEN_KEY, token);
}

export async function clearToken() {
  memoryToken = null;
  await storage.secureRemove(TOKEN_KEY);
}

export async function api<T>(path: string, init: RequestInit = {}, requiresAuth = false): Promise<T> {
  const token = await getToken();
  const response = await fetch(`${backendUrl}/api${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(init.headers || {}) },
  });
  if (response.status === 401 && requiresAuth) {
    await clearToken();
  }
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.detail || "Bir şeyler ters gitti");
  return body as T;
}

export async function login(email: string, password: string) {
  const result = await api<{ session_token: string; user: User }>("/auth/login", { method: "POST", body: JSON.stringify({ email, password }) });
  await setToken(result.session_token);
  return result.user;
}

export async function register(name: string, email: string, password: string) {
  const result = await api<{ session_token: string; user: User }>("/auth/register", { method: "POST", body: JSON.stringify({ name, email, password }) });
  await setToken(result.session_token);
  return result.user;
}

export async function guest(name = "Guest Learner") {
  const result = await api<{ session_token: string; user: User }>("/auth/guest", { method: "POST", body: JSON.stringify({ name }) });
  await setToken(result.session_token);
  return result.user;
}

export async function appleAuth(identityToken: string, name?: string, email?: string) {
  const result = await api<{ session_token: string; user: User }>("/auth/apple", { method: "POST", body: JSON.stringify({ identity_token: identityToken, name, email }) });
  await setToken(result.session_token);
  return result.user;
}

export async function updateProfile(payload: { name?: string; username?: string }) {
  const result = await api<{ user: User }>("/users/me", { method: "PATCH", body: JSON.stringify(payload) }, true);
  return result.user;
}

export async function currentUser() {
  const token = await getToken();
  if (!token) return null;
  try {
    const result = await api<{ user: User }>("/auth/me", {}, true);
    return result.user;
  } catch {
    return null;
  }
}

export const fetchFeed = () => api<Question[]>("/feed");
export const fetchComments = (questionId: string) => api<Comment[]>(`/questions/${questionId}/comments`);
export const addComment = (questionId: string, text: string) => api<Comment>(`/questions/${questionId}/comments`, { method: "POST", body: JSON.stringify({ text }) }, true);
export const answerQuestion = (questionId: string, optionIndex: number) =>
  api<{ correct: boolean; already_answered: boolean; correct_index?: number; explanation?: string; earned: number; point_progress: number; point_rate: number; user: User }>(
    `/questions/${questionId}/answer`,
    { method: "POST", body: JSON.stringify({ option_index: optionIndex }) },
    true,
  );
export const toggleSave = (questionId: string) => api<{ saved: boolean }>(`/questions/${questionId}/save`, { method: "POST" }, true);
export const createQuestion = (payload: { category: string; text: string; options: string[]; correct_index: number; explanation: string; difficulty: string; background?: string | null }) =>
  api<Question>("/questions", { method: "POST", body: JSON.stringify(payload) }, true);
export const fetchLeaderboard = () => api<Leader[]>("/leaderboard");
export const fetchPeople = () => api<Person[]>("/people", {}, true);
export const fetchConversations = () => api<Conversation[]>("/conversations", {}, true);
export const fetchMessages = (userId: string) => api<Message[]>(`/conversations/${userId}/messages`, {}, true);
export const sendMessage = (userId: string, text: string, questionId?: string) =>
  api<Message>(`/conversations/${userId}/messages`, { method: "POST", body: JSON.stringify({ text, question_id: questionId }) }, true);

// Depolanan bir dosyanın (ör. soru arka planı) görüntülenebilir URL'i.
// Web'de <img> header gönderemediği için token query param olarak eklenir.
export async function fileUrl(path: string): Promise<string> {
  const token = await getToken();
  return `${backendUrl}/api/files/${path}${token ? `?token=${encodeURIComponent(token)}` : ""}`;
}

export async function uploadImage(uri: string, mimeType?: string): Promise<string> {
  const token = await getToken();
  const form = new FormData();
  const name = uri.split("/").pop() || "photo.jpg";
  const type = mimeType || "image/jpeg";
  if (Platform.OS === "web") {
    const blob = await (await fetch(uri)).blob();
    form.append("file", blob, name);
  } else {
    form.append("file", { uri, name, type } as unknown as Blob);
  }
  const response = await fetch(`${backendUrl}/api/uploads`, {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: form,
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.detail || "Yükleme başarısız");
  return body.path as string;
}
