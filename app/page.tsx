"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import {
  AlertTriangle,
  Bell,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  Check,
  Clock3,
  KeyRound,
  LayoutDashboard,
  Link2,
  ListTodo,
  LogOut,
  Menu,
  Mail,
  MessageSquareText,
  Pencil,
  Plus,
  RefreshCw,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Calendar as PlannerCalendar } from "@/components/ui/calendar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AuthConfigurationState,
  AuthLoading,
  AuthPanel,
  PasswordResetPanel,
  useStudySyncAuth,
} from "@/components/studysync-auth";
import { StudySyncLogo } from "@/components/studysync-logo";

type DuePeriod = "AM" | "PM";
type PlannerView = "planner" | "calendar" | "completed" | "reminders" | "account";
type CourseColors = Record<string, string>;

type Assignment = {
  id: number;
  title: string;
  course: string;
  dueAt: string;
  estimatedMinutes: number;
  completed: boolean | number;
  updatedAt: string;
};

type AssignmentForm = {
  title: string;
  course: string;
  dueMonth: string;
  dueDay: string;
  dueYear: string;
  dueHour: string;
  dueMinute: string;
  duePeriod: DuePeriod;
  courseColor: string;
  estimatedMinutes: string;
};

const COURSE_COLOR_OPTIONS = [
  { name: "Blue", value: "#4f8df7", foreground: "#ffffff" },
  { name: "Red", value: "#e6605c", foreground: "#ffffff" },
  { name: "Yellow", value: "#e4b640", foreground: "#173746" },
  { name: "Pink", value: "#ed8fa8", foreground: "#173746" },
  { name: "Black", value: "#1f2d35", foreground: "#ffffff" },
  { name: "Purple", value: "#9774d4", foreground: "#ffffff" },
  { name: "Dark grey", value: "#60727a", foreground: "#ffffff" },
  { name: "Green", value: "#49aa78", foreground: "#ffffff" },
  { name: "Brown", value: "#a67555", foreground: "#ffffff" },
  { name: "Tan", value: "#d9b487", foreground: "#173746" },
] as const;

const DEFAULT_COURSE_COLOR = COURSE_COLOR_OPTIONS[0].value;

const blankForm: AssignmentForm = {
  title: "",
  course: "",
  dueMonth: "",
  dueDay: "",
  dueYear: "",
  dueHour: "11",
  dueMinute: "59",
  duePeriod: "PM",
  courseColor: DEFAULT_COURSE_COLOR,
  estimatedMinutes: "60",
};

const navigationItems: Array<{ id: PlannerView; label: string; icon: LucideIcon }> = [
  { id: "planner", label: "Planner", icon: LayoutDashboard },
  { id: "calendar", label: "Calendar", icon: CalendarDays },
  { id: "completed", label: "Completed", icon: CheckCircle2 },
  { id: "reminders", label: "Reminders", icon: Bell },
  { id: "account", label: "Account", icon: UserRound },
];

const localPreviewClient = {
  auth: {
    updateUser: async () => ({ data: { user: null }, error: null }),
  },
} as unknown as SupabaseClient;

function calendarDayKey(date: Date) {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

function isToday(date: Date) {
  return calendarDayKey(date) === calendarDayKey(new Date());
}

function isTomorrow(date: Date) {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  return calendarDayKey(date) === calendarDayKey(tomorrow);
}

function dayDiffFromToday(date: Date) {
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const startOfDate = new Date(date);
  startOfDate.setHours(0, 0, 0, 0);
  return Math.round((startOfDate.getTime() - startOfToday.getTime()) / 86_400_000);
}

function isWithinWeek(date: Date) {
  const diff = dayDiffFromToday(date);
  return diff >= 0 && diff <= 6;
}

type StudyRange = "day" | "week" | "all";

const STUDY_RANGE_LABELS: Record<StudyRange, string> = {
  day: "Today",
  week: "This week",
  all: "Everything",
};

function formatDueDate(value: string) {
  const date = new Date(value);
  if (isToday(date)) return "Today";
  if (isTomorrow(date)) return "Tomorrow";
  return new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(date);
}

function formatDueTime(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatHeaderDate() {
  return new Intl.DateTimeFormat(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  }).format(new Date());
}

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

function metadataString(metadata: Record<string, unknown> | undefined, key: string) {
  const value = metadata?.[key];
  return typeof value === "string" ? value.trim() : "";
}

function courseColorKey(course: string) {
  return course.trim().toLocaleLowerCase();
}

function validCourseColor(value: unknown): value is string {
  return typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value);
}

function isSelectedCourseColor(value: string, optionValue: string) {
  return value.toLowerCase() === optionValue.toLowerCase();
}

function courseColorsFromMetadata(metadata: Record<string, unknown>) {
  const stored = metadata.studysync_course_colors;
  if (!stored || typeof stored !== "object") return {};

  return Object.entries(stored as Record<string, unknown>).reduce<CourseColors>(
    (colors, [course, color]) => {
      if (course && validCourseColor(color)) colors[courseColorKey(course)] = color;
      return colors;
    },
    {},
  );
}

function getCourseColor(course: string, courseColors: CourseColors) {
  return courseColors[courseColorKey(course)] ?? DEFAULT_COURSE_COLOR;
}

function accountInitials(firstName: string, lastName: string, email: string) {
  if (firstName || lastName) {
    const firstInitial = firstName.slice(0, 1) || lastName.slice(0, 1);
    const secondInitial = lastName.slice(0, 1) || firstName.slice(1, 2);
    return `${firstInitial}${secondInitial}`.toUpperCase();
  }

  const emailName = email.split("@")[0].replace(/[^a-zA-Z0-9]/g, "");
  return (emailName.slice(0, 2) || "SS").toUpperCase();
}

function isComplete(assignment: Assignment) {
  return assignment.completed === true || assignment.completed === 1;
}

function storedTimestamp(value: string) {
  const normalized = value.includes("T") ? value : `${value.replace(" ", "T")}Z`;
  const timestamp = Date.parse(normalized);
  return Number.isFinite(timestamp) ? timestamp : Date.parse(value);
}

const RECENT_COMPLETION_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
const RECENT_COMPLETION_CLOCK_SKEW_MS = 5 * 60 * 1000;

function isRecentlyCompleted(assignment: Assignment) {
  if (!isComplete(assignment)) return false;
  const completedAt = storedTimestamp(assignment.updatedAt);
  const age = Date.now() - completedAt;
  return (
    Number.isFinite(completedAt) &&
    age >= -RECENT_COMPLETION_CLOCK_SKEW_MS &&
    age <= RECENT_COMPLETION_WINDOW_MS
  );
}

function isOverdue(value: string) {
  const dueAt = new Date(value).getTime();
  return Number.isFinite(dueAt) && dueAt < Date.now();
}

function formatCompletedDate(value: string) {
  const completedAt = storedTimestamp(value);
  if (!Number.isFinite(completedAt)) return "recently";
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
  }).format(new Date(completedAt));
}

function formatStudyTime(minutes: number) {
  if (minutes === 0) return "0 min";
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  if (!hours) return `${remainingMinutes} min`;
  if (!remainingMinutes) return `${hours} hr`;
  return `${hours} hr ${remainingMinutes} min`;
}

function localPreviewTimestamp(daysFromToday: number, hour: number, minute: number) {
  const date = new Date();
  date.setDate(date.getDate() + daysFromToday);
  date.setHours(hour, minute, 0, 0);
  return date.toISOString();
}

function localPreviewAssignments(): Assignment[] {
  return [
    {
      id: 101,
      title: "Submit research paper outline",
      course: "CS 401",
      dueAt: localPreviewTimestamp(1, 17, 0),
      estimatedMinutes: 60,
      completed: false,
      updatedAt: new Date().toISOString(),
    },
    {
      id: 102,
      title: "Biology lab report",
      course: "Biology 210",
      dueAt: localPreviewTimestamp(3, 23, 59),
      estimatedMinutes: 90,
      completed: false,
      updatedAt: new Date().toISOString(),
    },
    {
      id: 103,
      title: "History reading response",
      course: "History 120",
      dueAt: localPreviewTimestamp(6, 11, 59),
      estimatedMinutes: 45,
      completed: false,
      updatedAt: new Date().toISOString(),
    },
    {
      id: 104,
      title: "Complete practice quiz",
      course: "CS 401",
      dueAt: localPreviewTimestamp(-1, 23, 59),
      estimatedMinutes: 30,
      completed: false,
      updatedAt: new Date().toISOString(),
    },
    {
      id: 105,
      title: "Week 2 discussion post",
      course: "History 120",
      dueAt: localPreviewTimestamp(-2, 23, 59),
      estimatedMinutes: 30,
      completed: true,
      updatedAt: localPreviewTimestamp(-1, 13, 0),
    },
  ];
}

function padNumber(value: number) {
  return String(value).padStart(2, "0");
}

function numericInput(value: string, maxLength: number) {
  return value.replace(/\D/g, "").slice(0, maxLength);
}

function formFromAssignment(assignment: Assignment, courseColors: CourseColors): AssignmentForm {
  const date = new Date(assignment.dueAt);
  if (!Number.isFinite(date.getTime())) {
    return {
      ...blankForm,
      title: assignment.title,
      course: assignment.course,
      courseColor: getCourseColor(assignment.course, courseColors),
      estimatedMinutes: String(assignment.estimatedMinutes),
    };
  }

  const hour = date.getHours();
  return {
    title: assignment.title,
    course: assignment.course,
    dueMonth: padNumber(date.getMonth() + 1),
    dueDay: padNumber(date.getDate()),
    dueYear: String(date.getFullYear()).padStart(4, "0"),
    dueHour: String(hour % 12 || 12),
    dueMinute: padNumber(date.getMinutes()),
    duePeriod: hour >= 12 ? "PM" : "AM",
    courseColor: getCourseColor(assignment.course, courseColors),
    estimatedMinutes: String(assignment.estimatedMinutes),
  };
}

function buildDueAt(form: AssignmentForm) {
  const month = Number(form.dueMonth);
  const day = Number(form.dueDay);
  const year = Number(form.dueYear);
  const hour = Number(form.dueHour);
  const minute = Number(form.dueMinute);

  if (!/^\d{4}$/.test(form.dueYear) || !Number.isInteger(year) || year < 1) {
    throw new Error("Enter a four-digit year.");
  }
  if (
    !Number.isInteger(month) ||
    month < 1 ||
    month > 12 ||
    !Number.isInteger(day) ||
    day < 1 ||
    day > 31
  ) {
    throw new Error("Enter a valid due date.");
  }
  if (
    !Number.isInteger(hour) ||
    hour < 1 ||
    hour > 12 ||
    !Number.isInteger(minute) ||
    minute < 0 ||
    minute > 59
  ) {
    throw new Error("Enter a valid due time.");
  }

  const candidate = new Date(year, month - 1, day);
  if (
    candidate.getFullYear() !== year ||
    candidate.getMonth() !== month - 1 ||
    candidate.getDate() !== day
  ) {
    throw new Error("Enter a real calendar date.");
  }

  const hour24 =
    form.duePeriod === "PM" ? (hour === 12 ? 12 : hour + 12) : hour === 12 ? 0 : hour;
  return `${year}-${padNumber(month)}-${padNumber(day)}T${padNumber(hour24)}:${padNumber(minute)}`;
}

type AssignmentFieldsProps = {
  form: AssignmentForm;
  idPrefix: string;
  dark?: boolean;
  onChange: (updates: Partial<AssignmentForm>) => void;
};

function AssignmentFields({ form, idPrefix, dark = false, onChange }: AssignmentFieldsProps) {
  const labelClass = dark ? "text-white/70" : "text-[#52717c]";
  const inputClass = dark
    ? "border-white/15 bg-white/[0.08] text-white placeholder:text-white/35 focus-visible:border-[#62d2be] focus-visible:ring-[#62d2be]/30"
    : "border-[#d8e4e7] text-[#173746] placeholder:text-[#a9b9be] focus-visible:border-[#62b2a5] focus-visible:ring-[#62b2be]/25";
  const selectClass = dark
    ? "w-full border-white/15 bg-white/[0.08] text-white focus-visible:border-[#62d2be] focus-visible:ring-[#62d2be]/30"
    : "w-full border-[#d8e4e7] text-[#173746] focus-visible:border-[#62b2a5] focus-visible:ring-[#62b2be]/25";
  const hintClass = dark
    ? "text-[11px] leading-4 text-white/45"
    : "text-xs leading-5 text-[#78909b]";

  return (
    <>
      <div className="space-y-2">
        <Label className={labelClass}>Due date</Label>
        <div className="grid grid-cols-[1fr_1fr_1.35fr] gap-2">
          <Input
            id={`${idPrefix}-month`}
            required
            inputMode="numeric"
            maxLength={2}
            value={form.dueMonth}
            onChange={(event) => onChange({ dueMonth: numericInput(event.target.value, 2) })}
            placeholder="MM"
            aria-label="Due month"
            className={inputClass}
          />
          <Input
            id={`${idPrefix}-day`}
            required
            inputMode="numeric"
            maxLength={2}
            value={form.dueDay}
            onChange={(event) => onChange({ dueDay: numericInput(event.target.value, 2) })}
            placeholder="DD"
            aria-label="Due day"
            className={inputClass}
          />
          <Input
            id={`${idPrefix}-year`}
            required
            inputMode="numeric"
            maxLength={4}
            value={form.dueYear}
            onChange={(event) => onChange({ dueYear: numericInput(event.target.value, 4) })}
            placeholder="YYYY"
            aria-label="Due year"
            className={inputClass}
          />
        </div>
        <p className={hintClass}>Month / day / four-digit year</p>
      </div>

      <div className="space-y-2">
        <Label className={labelClass}>Due time</Label>
        <div className="grid grid-cols-[1fr_1fr_1.15fr] gap-2">
          <Input
            id={`${idPrefix}-hour`}
            required
            inputMode="numeric"
            maxLength={2}
            value={form.dueHour}
            onChange={(event) => onChange({ dueHour: numericInput(event.target.value, 2) })}
            placeholder="11"
            aria-label="Due hour"
            className={inputClass}
          />
          <Input
            id={`${idPrefix}-minute`}
            required
            inputMode="numeric"
            maxLength={2}
            value={form.dueMinute}
            onChange={(event) => onChange({ dueMinute: numericInput(event.target.value, 2) })}
            placeholder="59"
            aria-label="Due minute"
            className={inputClass}
          />
          <Select
            value={form.duePeriod}
            onValueChange={(value) => onChange({ duePeriod: value as DuePeriod })}
          >
            <SelectTrigger aria-label="AM or PM" className={selectClass}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="AM">AM</SelectItem>
              <SelectItem value="PM">PM</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <p className={hintClass}>Defaults to 11:59 PM</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label className={labelClass}>Class color</Label>
          <div className="grid grid-cols-5 gap-2" role="radiogroup" aria-label="Class color presets">
            {COURSE_COLOR_OPTIONS.map((option) => {
              const selected = isSelectedCourseColor(form.courseColor, option.value);
              return (
                <button
                  key={option.value}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  aria-label={`${option.name} class color`}
                  title={option.name}
                  onClick={() => onChange({ courseColor: option.value })}
                  className={`rounded-xl border p-1.5 text-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#62d2be]/60 ${
                    selected
                      ? dark
                        ? "border-[#62d2be] bg-white/10 ring-2 ring-[#62d2be]/35"
                        : "border-[#2f9584] bg-[#eefbf7] ring-2 ring-[#62b2a5]/25"
                      : dark
                        ? "border-white/10 bg-white/[0.04] hover:border-white/25 hover:bg-white/[0.08]"
                        : "border-[#d8e4e7] bg-white hover:border-[#a9caca] hover:bg-[#f7fafb]"
                  }`}
                >
                  <span
                    className="relative flex h-8 items-center justify-center rounded-lg border border-black/10"
                    style={{ backgroundColor: option.value }}
                  >
                    {selected ? <Check className="size-4" strokeWidth={3} style={{ color: option.foreground }} /> : null}
                  </span>
                </button>
              );
            })}
          </div>
          <p className={hintClass}>Pick a preset. It is saved for the course and used on its assignments.</p>
        </div>
        <div className="space-y-2">
          <Label htmlFor={`${idPrefix}-study-time`} className={labelClass}>Study time</Label>
          <Input
            id={`${idPrefix}-study-time`}
            type="number"
            min="5"
            max="1440"
            step="5"
            value={form.estimatedMinutes}
            onChange={(event) => onChange({ estimatedMinutes: event.target.value })}
            className={inputClass}
          />
        </div>
      </div>
    </>
  );
}

type AccountViewProps = {
  client: SupabaseClient;
  email: string;
  metadata: Record<string, unknown>;
};

function accountErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : "We could not update your account.";
  const normalized = message.toLowerCase();

  if (normalized.includes("same as the old email") || normalized.includes("same email")) {
    return "That is already the email on your account.";
  }
  if (normalized.includes("invalid email")) return "Enter a valid email address.";
  if (normalized.includes("password should be at least")) {
    return "Choose a password with at least 8 characters.";
  }
  return message;
}

function AccountView({ client, email, metadata }: AccountViewProps) {
  const [firstName, setFirstName] = useState(() => metadataString(metadata, "first_name"));
  const [lastName, setLastName] = useState(() => metadataString(metadata, "last_name"));
  const [nextEmail, setNextEmail] = useState(email);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [profileSaving, setProfileSaving] = useState(false);
  const [emailSaving, setEmailSaving] = useState(false);
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function handleProfileUpdate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalizedFirstName = firstName.trim();
    const normalizedLastName = lastName.trim();
    if (!normalizedFirstName || !normalizedLastName) {
      setError("Enter both your first and last name.");
      setNotice("");
      return;
    }

    setProfileSaving(true);
    setError("");
    setNotice("");
    try {
      const result = await client.auth.updateUser({
        data: {
          ...metadata,
          first_name: normalizedFirstName,
          last_name: normalizedLastName,
        },
      });
      if (result.error) throw result.error;
      setFirstName(normalizedFirstName);
      setLastName(normalizedLastName);
      setNotice("Your profile has been updated.");
    } catch (updateError) {
      setError(accountErrorMessage(updateError));
    } finally {
      setProfileSaving(false);
    }
  }

  async function handleEmailUpdate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalizedEmail = nextEmail.trim();
    if (!normalizedEmail || normalizedEmail === email) {
      setError("Enter a new email address to update it.");
      setNotice("");
      return;
    }

    setEmailSaving(true);
    setError("");
    setNotice("");
    try {
      const result = await client.auth.updateUser({ email: normalizedEmail });
      if (result.error) throw result.error;
      setNotice("Check your new email address to confirm the change.");
    } catch (updateError) {
      setError(accountErrorMessage(updateError));
    } finally {
      setEmailSaving(false);
    }
  }

  async function handlePasswordUpdate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (newPassword.length < 8) {
      setError("Choose a password with at least 8 characters.");
      setNotice("");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("The passwords do not match.");
      setNotice("");
      return;
    }

    setPasswordSaving(true);
    setError("");
    setNotice("");
    try {
      const result = await client.auth.updateUser({ password: newPassword });
      if (result.error) throw result.error;
      setNewPassword("");
      setConfirmPassword("");
      setNotice("Your password has been updated.");
    } catch (updateError) {
      setError(accountErrorMessage(updateError));
    } finally {
      setPasswordSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-4xl">
      <div>
        <p className="mb-2 text-sm font-semibold text-[#2f9584]">Account</p>
        <h1 className="text-[clamp(2rem,4vw,3.3rem)] font-bold leading-[1.05] tracking-[-0.055em] text-[#102b3a]">
          Manage your account.
        </h1>
        <p className="mt-3 max-w-xl text-[15px] leading-6 text-[#66818c]">
          Keep your profile details current, then update the email address or password you use to sign in.
        </p>
      </div>

      <div className="mt-8 grid gap-5 lg:grid-cols-2">
        <Card className="border-0 bg-white py-0 shadow-[0_12px_34px_rgb(16_43_58/6%)] lg:col-span-2">
          <CardHeader className="px-5 pb-2 pt-5 sm:px-6 sm:pt-6">
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-2xl bg-[#edf8f6] text-[#2f9584]">
                <UserRound className="size-5" />
              </div>
              <div>
                <CardTitle className="text-xl tracking-[-0.035em] text-[#173746]">Your name</CardTitle>
                <CardDescription className="mt-1 text-[#78909b]">This is used for your StudySync greeting.</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="px-5 pb-6 pt-4 sm:px-6">
            <form className="space-y-4" onSubmit={handleProfileUpdate}>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="account-first-name" className="text-[#52717c]">First name</Label>
                  <Input
                    id="account-first-name"
                    required
                    autoComplete="given-name"
                    value={firstName}
                    onChange={(event) => setFirstName(event.target.value)}
                    placeholder="First name"
                    className="h-11 border-[#d8e4e7] text-[#173746] placeholder:text-[#a9b9be] focus-visible:border-[#62b2a5] focus-visible:ring-[#62b2be]/25"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="account-last-name" className="text-[#52717c]">Last name</Label>
                  <Input
                    id="account-last-name"
                    required
                    autoComplete="family-name"
                    value={lastName}
                    onChange={(event) => setLastName(event.target.value)}
                    placeholder="Last name"
                    className="h-11 border-[#d8e4e7] text-[#173746] placeholder:text-[#a9b9be] focus-visible:border-[#62b2a5] focus-visible:ring-[#62b2be]/25"
                  />
                </div>
              </div>
              <Button
                type="submit"
                disabled={profileSaving || emailSaving || passwordSaving}
                className="h-11 w-full rounded-xl bg-[#0d2b3a] font-semibold text-white hover:bg-[#173f50] sm:w-auto sm:px-6"
              >
                {profileSaving ? "Saving profile…" : "Save name"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card className="border-0 bg-white py-0 shadow-[0_12px_34px_rgb(16_43_58/6%)]">
          <CardHeader className="px-5 pb-2 pt-5 sm:px-6 sm:pt-6">
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-2xl bg-[#edf8f6] text-[#2f9584]">
                <Mail className="size-5" />
              </div>
              <div>
                <CardTitle className="text-xl tracking-[-0.035em] text-[#173746]">Email address</CardTitle>
                <CardDescription className="mt-1 text-[#78909b]">Used for sign-in and account recovery.</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="px-5 pb-6 pt-4 sm:px-6">
            <form className="space-y-4" onSubmit={handleEmailUpdate}>
              <div className="space-y-2">
                <Label htmlFor="account-email" className="text-[#52717c]">New email address</Label>
                <Input
                  id="account-email"
                  required
                  type="email"
                  autoComplete="email"
                  value={nextEmail}
                  onChange={(event) => setNextEmail(event.target.value)}
                  className="h-11 border-[#d8e4e7] text-[#173746] placeholder:text-[#a9b9be] focus-visible:border-[#62b2a5] focus-visible:ring-[#62b2be]/25"
                />
              </div>
              <Button
                type="submit"
                disabled={profileSaving || emailSaving || passwordSaving}
                className="h-11 w-full rounded-xl bg-[#0d2b3a] font-semibold text-white hover:bg-[#173f50]"
              >
                {emailSaving ? "Updating email…" : "Update email"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card className="border-0 bg-white py-0 shadow-[0_12px_34px_rgb(16_43_58/6%)]">
          <CardHeader className="px-5 pb-2 pt-5 sm:px-6 sm:pt-6">
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-2xl bg-[#fff8e8] text-[#c08b25]">
                <KeyRound className="size-5" />
              </div>
              <div>
                <CardTitle className="text-xl tracking-[-0.035em] text-[#173746]">Password</CardTitle>
                <CardDescription className="mt-1 text-[#78909b]">Use at least 8 characters.</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="px-5 pb-6 pt-4 sm:px-6">
            <form className="space-y-4" onSubmit={handlePasswordUpdate}>
              <div className="space-y-2">
                <Label htmlFor="account-password" className="text-[#52717c]">New password</Label>
                <Input
                  id="account-password"
                  required
                  minLength={8}
                  type="password"
                  autoComplete="new-password"
                  value={newPassword}
                  onChange={(event) => setNewPassword(event.target.value)}
                  placeholder="At least 8 characters"
                  className="h-11 border-[#d8e4e7] text-[#173746] placeholder:text-[#a9b9be] focus-visible:border-[#62b2a5] focus-visible:ring-[#62b2be]/25"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="account-confirm-password" className="text-[#52717c]">Confirm new password</Label>
                <Input
                  id="account-confirm-password"
                  required
                  minLength={8}
                  type="password"
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  placeholder="Repeat your new password"
                  className="h-11 border-[#d8e4e7] text-[#173746] placeholder:text-[#a9b9be] focus-visible:border-[#62b2a5] focus-visible:ring-[#62b2be]/25"
                />
              </div>
              <Button
                type="submit"
                disabled={profileSaving || emailSaving || passwordSaving}
                className="h-11 w-full rounded-xl bg-[#0d2b3a] font-semibold text-white hover:bg-[#173f50]"
              >
                {passwordSaving ? "Updating password…" : "Update password"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>

      {error ? (
        <p className="mt-5 rounded-xl border border-[#f29f95] bg-[#fff1ef] px-4 py-3 text-sm leading-6 text-[#a93e35]" role="alert">
          {error}
        </p>
      ) : null}
      {notice ? (
        <p className="mt-5 rounded-xl border border-[#a9d9cf] bg-[#eefbf7] px-4 py-3 text-sm leading-6 text-[#287568]" role="status">
          {notice}
        </p>
      ) : null}

      <div className="mt-5 flex items-start gap-3 rounded-2xl border border-[#d8e4e7] bg-white px-4 py-3.5 text-sm leading-6 text-[#52717c] shadow-[0_10px_28px_rgb(16_43_58/4%)]">
        <ShieldCheck className="mt-0.5 size-5 shrink-0 text-[#2f9584]" />
        <p>Your password is handled by Supabase’s secure account service. StudySync does not store it in the planner database.</p>
      </div>
    </div>
  );
}

type CalendarViewProps = {
  assignments: Assignment[];
  courseColors: CourseColors;
  onEdit: (assignment: Assignment) => void;
};

function calendarDateFromKey(key: string) {
  const [year, month, day] = key.split("-").map(Number);
  return new Date(year, month, day);
}

function CalendarView({ assignments, courseColors, onEdit }: CalendarViewProps) {
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const [calendarMonth, setCalendarMonth] = useState(() => new Date());

  const assignmentsByDay = useMemo(() => {
    const grouped = new Map<string, Assignment[]>();
    assignments
      .filter((assignment) => !isComplete(assignment))
      .forEach((assignment) => {
        const dueDate = new Date(assignment.dueAt);
        if (!Number.isFinite(dueDate.getTime())) return;
        const key = calendarDayKey(dueDate);
        const dayAssignments = grouped.get(key) ?? [];
        dayAssignments.push(assignment);
        grouped.set(key, dayAssignments);
      });

    grouped.forEach((dayAssignments) => {
      dayAssignments.sort((first, second) => new Date(first.dueAt).getTime() - new Date(second.dueAt).getTime());
    });
    return grouped;
  }, [assignments]);

  const assignmentDates = useMemo(
    () => Array.from(assignmentsByDay.keys()).map(calendarDateFromKey),
    [assignmentsByDay],
  );
  const selectedAssignments = assignmentsByDay.get(calendarDayKey(selectedDate)) ?? [];

  return (
    <div className="mx-auto max-w-5xl">
      <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
        <div>
          <p className="mb-2 text-sm font-semibold text-[#2f9584]">Calendar</p>
          <h1 className="text-[clamp(2rem,4vw,3.3rem)] font-bold leading-[1.05] tracking-[-0.055em] text-[#102b3a]">
            See what is coming up.
          </h1>
          <p className="mt-3 max-w-xl text-[15px] leading-6 text-[#66818c]">
            Select a day to see the assignments due then.
          </p>
        </div>
        <div className="flex items-center gap-2 text-sm text-[#66818c]">
          <span className="size-2 rounded-full bg-[#62d2be]" />
          {assignmentsByDay.size} {assignmentsByDay.size === 1 ? "day" : "days"} with assignments
        </div>
      </div>

      <div className="mt-8 grid items-start gap-5 lg:grid-cols-[minmax(0,1.1fr)_minmax(280px,0.9fr)]">
        <Card className="border-0 bg-white py-0 shadow-[0_12px_34px_rgb(16_43_58/6%)]">
          <CardHeader className="border-b border-[#e6eef0] px-5 py-5 sm:px-6">
            <CardTitle className="text-xl tracking-[-0.035em] text-[#173746]">Assignment calendar</CardTitle>
            <CardDescription className="mt-1.5 text-[#78909b]">
              Teal dates have at least one assignment due.
            </CardDescription>
          </CardHeader>
          <CardContent className="px-3 py-5 sm:px-6 sm:py-6">
            <PlannerCalendar
              mode="single"
              month={calendarMonth}
              onMonthChange={setCalendarMonth}
              selected={selectedDate}
              onSelect={(date) => {
                if (date) setSelectedDate(date);
              }}
              modifiers={{ hasAssignments: assignmentDates }}
              modifiersClassNames={{
                hasAssignments: "rounded-md bg-[#62d2be] font-bold text-[#0d2b3a] shadow-[inset_0_0_0_1px_#2f9584]",
              }}
              className="mx-auto w-full max-w-[430px] [--cell-size:2.7rem] sm:[--cell-size:3.4rem]"
              classNames={{
                month_caption: "flex h-(--cell-size) w-full items-center justify-center px-(--cell-size)",
                caption_label: "font-semibold text-[#173746]",
                weekday: "flex-1 rounded-md text-[0.8rem] font-semibold text-[#78909b] select-none",
              }}
            />
          </CardContent>
        </Card>

        <Card className="border-0 bg-white py-0 shadow-[0_12px_34px_rgb(16_43_58/6%)]">
          <CardHeader className="border-b border-[#e6eef0] px-5 py-5 sm:px-6">
            <CardTitle className="text-xl tracking-[-0.035em] text-[#173746]">
              {new Intl.DateTimeFormat(undefined, { weekday: "long", month: "long", day: "numeric" }).format(selectedDate)}
            </CardTitle>
            <CardDescription className="mt-1.5 text-[#78909b]">
              {selectedAssignments.length
                ? `${selectedAssignments.length} ${selectedAssignments.length === 1 ? "assignment" : "assignments"} due`
                : "Nothing due on this day"}
            </CardDescription>
          </CardHeader>
          <CardContent className="px-0">
            {selectedAssignments.length ? (
              <div className="divide-y divide-[#edf2f4]">
                {selectedAssignments.map((assignment) => {
                  const overdue = isOverdue(assignment.dueAt);
                  const courseColor = getCourseColor(assignment.course, courseColors);
                  return (
                    <article key={assignment.id} className="flex gap-3 px-5 py-4 sm:px-6">
                      <span
                        className="mt-0.5 h-14 w-1 shrink-0 rounded-full"
                        style={{ backgroundColor: courseColor }}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start gap-2">
                          <h2 className="min-w-0 flex-1 text-sm font-semibold leading-5 text-[#173746]">
                            {assignment.title}
                          </h2>
                          {overdue ? (
                            <Badge variant="outline" className="border-[#f39a8e] bg-[#fff0ed] font-bold uppercase tracking-[0.08em] text-[#b52f25]">
                              Overdue
                            </Badge>
                          ) : null}
                        </div>
                        <p className="mt-1 inline-flex items-center gap-2 text-sm font-medium text-[#52717c]">
                          <span
                            className="size-2.5 rounded-full border border-black/10"
                            style={{ backgroundColor: courseColor }}
                            aria-hidden="true"
                          />
                          {assignment.course}
                        </p>
                        <p className={`mt-1 text-xs ${overdue ? "font-semibold text-[#b52f25]" : "text-[#78909b]"}`}>
                          {overdue ? "Overdue · " : "Due "}{formatDueTime(assignment.dueAt)} · {formatStudyTime(assignment.estimatedMinutes)}
                        </p>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => onEdit(assignment)}
                          className="mt-2 h-8 rounded-lg px-2 text-xs font-semibold text-[#287568] hover:bg-[#eefbf7] hover:text-[#176052]"
                        >
                          <Pencil className="size-3.5" />
                          Edit assignment
                        </Button>
                      </div>
                    </article>
                  );
                })}
              </div>
            ) : (
              <div className="px-5 py-10 text-center sm:px-6">
                <CalendarDays className="mx-auto size-8 text-[#a9c4c8]" />
                <p className="mt-3 text-sm leading-6 text-[#78909b]">
                  Select a highlighted date to see its assignments.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

type CompletedViewProps = {
  assignments: Assignment[];
  courseColors: CourseColors;
  restoringId: number | null;
  onRestore: (assignment: Assignment, editAfterRestore?: boolean) => void;
};

function CompletedView({ assignments, courseColors, restoringId, onRestore }: CompletedViewProps) {
  const completedAssignments = useMemo(
    () =>
      assignments
        .filter(isComplete)
        .sort((first, second) => storedTimestamp(second.updatedAt) - storedTimestamp(first.updatedAt)),
    [assignments],
  );

  return (
    <div className="mx-auto max-w-4xl">
      <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
        <div>
          <p className="mb-2 text-sm font-semibold text-[#2f9584]">Completed</p>
          <h1 className="text-[clamp(2rem,4vw,3.3rem)] font-bold leading-[1.05] tracking-[-0.055em] text-[#102b3a]">
            Your finished work.
          </h1>
          <p className="mt-3 max-w-xl text-[15px] leading-6 text-[#66818c]">
            Keep a full history of completed assignments and add any one back when you need it.
          </p>
        </div>
        <div className="flex items-center gap-2 text-sm text-[#66818c]">
          <CheckCircle2 className="size-4 text-[#2f9584]" />
          {completedAssignments.length} completed
        </div>
      </div>

      <Card className="mt-8 border-0 bg-white py-0 shadow-[0_12px_34px_rgb(16_43_58/6%)]">
        <CardHeader className="border-b border-[#e6eef0] px-5 py-5 sm:px-6">
          <CardTitle className="text-xl tracking-[-0.035em] text-[#173746]">Completed assignments</CardTitle>
          <CardDescription className="mt-1.5 text-[#78909b]">
            Add one back as-is, or add it back and edit its name, course, date, or time.
          </CardDescription>
        </CardHeader>
        <CardContent className="px-0">
          {completedAssignments.length ? (
            <div className="divide-y divide-[#edf2f4]">
              {completedAssignments.map((assignment) => (
                <div key={assignment.id} className="flex flex-col gap-4 px-5 py-5 sm:flex-row sm:items-center sm:px-6">
                  <div className="flex min-w-0 flex-1 items-start gap-3">
                    <div
                      className="flex size-9 shrink-0 items-center justify-center rounded-full text-[#173746]"
                      style={{ backgroundColor: getCourseColor(assignment.course, courseColors) }}
                    >
                      <CheckCircle2 className="size-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-[#173746]">{assignment.title}</p>
                      <p className="mt-1 inline-flex items-center gap-2 text-sm font-medium text-[#52717c]">
                        <span
                          className="size-2.5 rounded-full border border-black/10"
                          style={{ backgroundColor: getCourseColor(assignment.course, courseColors) }}
                          aria-hidden="true"
                        />
                        {assignment.course}
                      </p>
                      <p className="mt-1 text-xs text-[#78909b]">
                        Due {formatDueDate(assignment.dueAt)} at {formatDueTime(assignment.dueAt)} · completed {formatCompletedDate(assignment.updatedAt)}
                      </p>
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-wrap items-center gap-2 sm:justify-end">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={restoringId !== null}
                      onClick={() => onRestore(assignment)}
                      className="rounded-xl border-[#c8dfe0] bg-white text-[#287568] hover:bg-[#eefbf7] hover:text-[#176052]"
                    >
                      {restoringId === assignment.id ? "Adding…" : "Add back"}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={restoringId !== null}
                      onClick={() => onRestore(assignment, true)}
                      className="rounded-xl text-[#52717c] hover:bg-[#f7fafb] hover:text-[#173746]"
                    >
                      Add back &amp; edit
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="px-6 py-14 text-center">
              <div className="mx-auto flex size-14 items-center justify-center rounded-[20px] bg-[#edf8f6] text-[#2f9584]">
                <CheckCircle2 className="size-6" />
              </div>
              <h2 className="mt-5 text-lg font-semibold tracking-[-0.025em] text-[#173746]">No completed assignments yet.</h2>
              <p className="mt-2 text-sm leading-6 text-[#78909b]">Completed work will stay here for you to revisit.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

type ReminderTiming = "morning" | "day-before" | "both";

type ReminderSettings = {
  emailEnabled: boolean;
  emailTiming: ReminderTiming;
  timezone: string;
};

function browserTimeZone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

function reminderSettingsFromMetadata(metadata: Record<string, unknown>): ReminderSettings {
  const stored = metadata.studysync_reminders;
  if (!stored || typeof stored !== "object") {
    return { emailEnabled: false, emailTiming: "morning", timezone: browserTimeZone() };
  }
  const settings = stored as Record<string, unknown>;
  const timing = settings.emailTiming;
  return {
    emailEnabled: settings.emailEnabled === true,
    emailTiming: timing === "day-before" || timing === "both" ? timing : "morning",
    timezone: typeof settings.timezone === "string" && settings.timezone ? settings.timezone : browserTimeZone(),
  };
}

type RemindersViewProps = {
  client: SupabaseClient;
  email: string;
  metadata: Record<string, unknown>;
  accessToken: string;
};

function RemindersView({ client, email, metadata, accessToken }: RemindersViewProps) {
  const initialSettings = reminderSettingsFromMetadata(metadata);
  const [emailEnabled, setEmailEnabled] = useState(initialSettings.emailEnabled);
  const [emailTiming, setEmailTiming] = useState<ReminderTiming>(initialSettings.emailTiming);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function saveEmailSettings() {
    setSaving(true);
    setError("");
    setNotice("");
    try {
      if (!accessToken) throw new Error("Your session has expired. Please sign in again.");

      const timezone = browserTimeZone();
      const reminderResponse = await fetch("/api/reminders", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ emailEnabled, emailTiming, timezone }),
      });
      const reminderPayload = (await reminderResponse.json()) as { error?: string };
      if (!reminderResponse.ok) {
        throw new Error(reminderPayload.error ?? "We could not save your reminder preferences.");
      }

      const result = await client.auth.updateUser({
        data: {
          ...metadata,
          studysync_reminders: { emailEnabled, emailTiming, timezone },
        },
      });
      if (result.error) throw result.error;
      setNotice(
        emailEnabled
          ? "Email reminders are on. StudySync will check your planner each hour and send the next matching reminder."
          : "Email reminders are off.",
      );
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "We could not save your reminder preferences.");
    } finally {
      setSaving(false);
    }
  }

  async function sendTestEmail() {
    setTesting(true);
    setError("");
    setNotice("");
    try {
      if (!accessToken) throw new Error("Your session has expired. Please sign in again.");

      const response = await fetch("/api/reminders/test", {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error ?? "We could not send a test email.");
      }
      setNotice("Test email sent. Check your inbox and spam folder.");
    } catch (testError) {
      setError(testError instanceof Error ? testError.message : "We could not send a test email.");
    } finally {
      setTesting(false);
    }
  }

  return (
    <div className="mx-auto max-w-4xl">
      <div>
        <p className="mb-2 text-sm font-semibold text-[#2f9584]">Reminders</p>
        <h1 className="text-[clamp(2rem,4vw,3.3rem)] font-bold leading-[1.05] tracking-[-0.055em] text-[#102b3a]">
          Stay ahead of deadlines.
        </h1>
        <p className="mt-3 max-w-xl text-[15px] leading-6 text-[#66818c]">
          Choose how StudySync will keep you aware of upcoming assignments.
        </p>
      </div>

      <div className="mt-8 grid gap-5 lg:grid-cols-2">
        <Card className="border-0 bg-white py-0 shadow-[0_12px_34px_rgb(16_43_58/6%)]">
          <CardHeader className="px-5 pb-2 pt-5 sm:px-6 sm:pt-6">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="flex size-10 items-center justify-center rounded-2xl bg-[#edf8f6] text-[#2f9584]">
                  <Mail className="size-5" />
                </div>
                <div>
                  <CardTitle className="text-xl tracking-[-0.035em] text-[#173746]">Email reminders</CardTitle>
                  <CardDescription className="mt-1 text-[#78909b]">Sent to {email}</CardDescription>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span
                  className={`text-xs font-bold uppercase tracking-[0.08em] ${emailEnabled ? "text-[#2f9584]" : "text-[#9aaeb5]"}`}
                  aria-live="polite"
                >
                  {emailEnabled ? "On" : "Off"}
                </span>
                <Switch
                  checked={emailEnabled}
                  onCheckedChange={(checked) => setEmailEnabled(checked === true)}
                  aria-label="Enable email reminders"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent className="px-5 pb-6 pt-4 sm:px-6">
            <p className="text-sm leading-6 text-[#52717c]">
              Choose when you want a reminder for assignments that are still on your planner. Your local time zone is used.
            </p>
            <div className="mt-5 space-y-2">
              <Label className="text-[#52717c]">Reminder timing</Label>
              <Select value={emailTiming} onValueChange={(value) => setEmailTiming(value as ReminderTiming)}>
                <SelectTrigger className="w-full border-[#d8e4e7] text-[#173746] focus-visible:border-[#62b2a5] focus-visible:ring-[#62b2be]/25">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="morning">Morning of the due date</SelectItem>
                  <SelectItem value="day-before">One day before</SelectItem>
                  <SelectItem value="both">One day before and morning of</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button
              type="button"
              onClick={() => void saveEmailSettings()}
              disabled={saving || testing}
              className="mt-5 h-11 w-full rounded-xl bg-[#0d2b3a] font-semibold text-white hover:bg-[#173f50]"
            >
              {saving ? "Saving preferences…" : "Save email preferences"}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => void sendTestEmail()}
              disabled={saving || testing}
              className="mt-3 h-11 w-full rounded-xl border-[#b8d3d7] font-semibold text-[#173746] hover:bg-[#edf8f6] hover:text-[#176052]"
            >
              {testing ? "Sending test email…" : "Send test email"}
            </Button>
            <p className="mt-3 text-xs leading-5 text-[#78909b]">
              Turn reminders on above before saving. Scheduled reminders are grouped into one email and sent once per assignment for each selected window.
            </p>
          </CardContent>
        </Card>

        <Card className="border-0 bg-white py-0 shadow-[0_12px_34px_rgb(16_43_58/6%)]">
          <CardHeader className="px-5 pb-2 pt-5 sm:px-6 sm:pt-6">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="flex size-10 items-center justify-center rounded-2xl bg-[#fff8e8] text-[#c08b25]">
                  <MessageSquareText className="size-5" />
                </div>
                <div>
                  <CardTitle className="text-xl tracking-[-0.035em] text-[#173746]">SMS reminders</CardTitle>
                  <CardDescription className="mt-1 text-[#78909b]">Phone verification required</CardDescription>
                </div>
              </div>
              <Badge variant="outline" className="border-[#f5d293] bg-[#fff8e8] text-[#9a6b16]">Coming soon</Badge>
            </div>
          </CardHeader>
          <CardContent className="px-5 pb-6 pt-4 sm:px-6">
            <p className="text-sm leading-6 text-[#52717c]">
              Text reminders will be added after phone verification and SMS delivery are connected. You’ll be able to choose due-date and overdue alerts here.
            </p>
            <div className="mt-5 flex items-start gap-3 rounded-2xl border border-[#d8e4e7] bg-[#f7fafb] px-3.5 py-3 text-sm leading-5 text-[#78909b]">
              <ShieldCheck className="mt-0.5 size-5 shrink-0 text-[#2f9584]" />
              <p>StudySync won’t ask for a phone number until it can verify and use it securely.</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {error ? (
        <p className="mt-5 rounded-xl border border-[#f29f95] bg-[#fff1ef] px-4 py-3 text-sm leading-6 text-[#a93e35]" role="alert">{error}</p>
      ) : null}
      {notice ? (
        <p className="mt-5 rounded-xl border border-[#a9d9cf] bg-[#eefbf7] px-4 py-3 text-sm leading-6 text-[#287568]" role="status">{notice}</p>
      ) : null}
    </div>
  );
}

export default function Home() {
  const auth = useStudySyncAuth();
  const localPreviewMode =
    typeof window !== "undefined" &&
    ["terminal.local", "localhost", "127.0.0.1"].includes(window.location.hostname) &&
    new URLSearchParams(window.location.search).get("preview") === "1";
  const previewAssignments = useMemo(() => localPreviewAssignments(), []);
  const [view, setView] = useState<PlannerView>("planner");
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [studyRange, setStudyRange] = useState<StudyRange>("all");
  const [courseColorOverrides, setCourseColorOverrides] = useState<{
    userId: string;
    colors: CourseColors;
  } | null>(null);
  const [form, setForm] = useState<AssignmentForm>(blankForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<Assignment | null>(null);
  const [editForm, setEditForm] = useState<AssignmentForm>(blankForm);
  const [editSaving, setEditSaving] = useState(false);
  const [completingId, setCompletingId] = useState<number | null>(null);
  const [restoringId, setRestoringId] = useState<number | null>(null);
  const [assignmentToComplete, setAssignmentToComplete] = useState<Assignment | null>(null);
  const [signingOut, setSigningOut] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const accessToken = auth.session?.access_token ?? "";
  const userMetadata = useMemo(
    () => (auth.session?.user.user_metadata ?? {}) as Record<string, unknown>,
    [auth.session?.user.user_metadata],
  );
  const currentUserId = auth.session?.user.id ?? "";
  const accountClient = auth.client ?? (localPreviewMode ? localPreviewClient : null);
  const metadataCourseColors = useMemo(
    () => courseColorsFromMetadata(userMetadata),
    [userMetadata],
  );
  const courseColors = useMemo(
    () =>
      courseColorOverrides?.userId === currentUserId
        ? { ...metadataCourseColors, ...courseColorOverrides.colors }
        : metadataCourseColors,
    [courseColorOverrides, currentUserId, metadataCourseColors],
  );

  const loadAssignments = useCallback(async () => {
    if (localPreviewMode) {
      setAssignments(previewAssignments);
      setLoading(false);
      setError("");
      return;
    }

    if (!accessToken) {
      setAssignments([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/assignments", {
        cache: "no-store",
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const payload = (await response.json()) as {
        assignments?: Assignment[];
        error?: string;
      };
      if (!response.ok) throw new Error(payload.error ?? "Unable to load assignments.");
      setAssignments(payload.assignments ?? []);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "StudySync could not load your assignments.",
      );
    } finally {
      setLoading(false);
    }
  }, [accessToken, localPreviewMode, previewAssignments]);

  useEffect(() => {
    if (auth.status !== "ready" || !auth.session) return;

    const reloadTimer = window.setTimeout(() => {
      void loadAssignments();
    }, 0);

    return () => window.clearTimeout(reloadTimer);
  }, [auth.session, auth.status, loadAssignments]);

  const activeAssignments = useMemo(
    () => assignments.filter((assignment) => !isComplete(assignment)),
    [assignments],
  );

  const sortedAssignments = useMemo(
    () =>
      [...activeAssignments].sort(
        (first, second) => {
          const firstOverdue = isOverdue(first.dueAt);
          const secondOverdue = isOverdue(second.dueAt);
          if (firstOverdue !== secondOverdue) return firstOverdue ? -1 : 1;
          return new Date(first.dueAt).getTime() - new Date(second.dueAt).getTime();
        },
      ),
    [activeAssignments],
  );

  const overdueAssignments = useMemo(
    () => activeAssignments.filter((assignment) => isOverdue(assignment.dueAt)),
    [activeAssignments],
  );

  const recentlyCompletedAssignments = useMemo(
    () =>
      assignments
        .filter(isRecentlyCompleted)
        .sort((first, second) => storedTimestamp(second.updatedAt) - storedTimestamp(first.updatedAt)),
    [assignments],
  );

  const dueToday = useMemo(
    () => activeAssignments.filter((assignment) => isToday(new Date(assignment.dueAt))),
    [activeAssignments],
  );

  const dueThisWeek = useMemo(
    () => activeAssignments.filter((assignment) => isWithinWeek(new Date(assignment.dueAt))),
    [activeAssignments],
  );

  const studyRangeAssignments = useMemo(() => {
    if (studyRange === "day") return dueToday;
    if (studyRange === "week") return dueThisWeek;
    return activeAssignments;
  }, [studyRange, dueToday, dueThisWeek, activeAssignments]);

  const estimatedMinutes = useMemo(
    () =>
      studyRangeAssignments.reduce((total, assignment) => total + assignment.estimatedMinutes, 0),
    [studyRangeAssignments],
  );

  async function persistCourseColor(course: string, color: string) {
    if (!auth.client) throw new Error("Your account is not ready. Please refresh and try again.");

    const key = courseColorKey(course);
    const nextColors = {
      ...courseColorsFromMetadata(userMetadata),
      ...courseColors,
      [key]: validCourseColor(color) ? color : DEFAULT_COURSE_COLOR,
    };
    const result = await auth.client.auth.updateUser({
      data: {
        ...userMetadata,
        studysync_course_colors: nextColors,
      },
    });
    if (result.error) throw result.error;
    setCourseColorOverrides({ userId: currentUserId, colors: nextColors });
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!accessToken) {
      setError("Your session has expired. Please sign in again.");
      return;
    }

    setSaving(true);
    setError("");
    setNotice("");

    try {
      const dueAt = buildDueAt(form);
      const response = await fetch("/api/assignments", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: form.title,
          course: form.course,
          dueAt,
          estimatedMinutes: form.estimatedMinutes,
        }),
      });
      const payload = (await response.json()) as {
        assignment?: Assignment;
        error?: string;
      };
      const addedAssignment = payload.assignment;
      if (!response.ok || !addedAssignment) {
        throw new Error(payload.error ?? "Unable to save this assignment.");
      }

      setAssignments((current) => [...current, addedAssignment]);
      await persistCourseColor(form.course, form.courseColor);
      setForm(blankForm);
      setNotice("Assignment added to your planner.");
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "StudySync could not save this assignment.",
      );
    } finally {
      setSaving(false);
    }
  }

  function openEditDialog(assignment: Assignment) {
    setAssignmentToComplete(null);
    setEditing(assignment);
    setEditForm(formFromAssignment(assignment, courseColors));
    setError("");
    setNotice("");
  }

  async function handleEditSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editing) return;
    if (!accessToken) {
      setError("Your session has expired. Please sign in again.");
      return;
    }

    setEditSaving(true);
    setError("");
    setNotice("");

    try {
      const dueAt = buildDueAt(editForm);
      const response = await fetch("/api/assignments", {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id: editing.id,
          title: editForm.title,
          course: editForm.course,
          dueAt,
          estimatedMinutes: editForm.estimatedMinutes,
        }),
      });
      const payload = (await response.json()) as { assignment?: Assignment; error?: string };
      if (!response.ok || !payload.assignment) {
        throw new Error(payload.error ?? "Unable to update this assignment.");
      }

      setAssignments((current) =>
        current.map((item) => (item.id === editing.id ? payload.assignment! : item)),
      );
      await persistCourseColor(editForm.course, editForm.courseColor);
      setEditing(null);
      setNotice("Assignment updated.");
    } catch (editError) {
      setError(
        editError instanceof Error ? editError.message : "StudySync could not update this assignment.",
      );
    } finally {
      setEditSaving(false);
    }
  }

  async function handleSignOut() {
    setSigningOut(true);
    setError("");
    try {
      await auth.signOut();
    } catch (signOutError) {
      setError(
        signOutError instanceof Error ? signOutError.message : "StudySync could not sign you out.",
      );
    } finally {
      setSigningOut(false);
    }
  }

  async function handleComplete(assignment: Assignment) {
    if (!accessToken) {
      setError("Your session has expired. Please sign in again.");
      return false;
    }

    setCompletingId(assignment.id);
    setError("");
    setNotice("");

    try {
      const response = await fetch("/api/assignments", {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ id: assignment.id, completed: true }),
      });
      const payload = (await response.json()) as { assignment?: Assignment; error?: string };

      if (!response.ok || !payload.assignment) {
        throw new Error(payload.error ?? "Unable to mark this assignment complete.");
      }

      setAssignments((current) =>
        current.map((item) => (item.id === assignment.id ? payload.assignment! : item)),
      );
      setNotice("Assignment marked complete and removed from your planner.");
      return true;
    } catch (completeError) {
      setError(
        completeError instanceof Error
          ? completeError.message
          : "StudySync could not update this assignment.",
      );
      return false;
    } finally {
      setCompletingId(null);
    }
  }

  async function confirmComplete() {
    if (!assignmentToComplete || completingId !== null) return;
    const didComplete = await handleComplete(assignmentToComplete);
    if (didComplete) setAssignmentToComplete(null);
  }

  async function handleRestore(assignment: Assignment, editAfterRestore = false) {
    if (!accessToken) {
      setError("Your session has expired. Please sign in again.");
      return;
    }

    setRestoringId(assignment.id);
    setError("");
    setNotice("");

    try {
      const response = await fetch("/api/assignments", {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ id: assignment.id, completed: false }),
      });
      const payload = (await response.json()) as { assignment?: Assignment; error?: string };

      const restoredAssignment = payload.assignment;
      if (!response.ok || !restoredAssignment) {
        throw new Error(payload.error ?? "Unable to add this assignment back.");
      }

      setAssignments((current) =>
        current.map((item) => (item.id === assignment.id ? restoredAssignment : item)),
      );
      if (editAfterRestore) {
        openEditDialog(restoredAssignment);
      } else {
        setNotice("Assignment added back to your planner.");
      }
    } catch (restoreError) {
      setError(
        restoreError instanceof Error
          ? restoreError.message
          : "StudySync could not restore this assignment.",
      );
    } finally {
      setRestoringId(null);
    }
  }

  if (auth.status === "loading") return <AuthLoading />;
  if (auth.status === "error") return <AuthConfigurationState message={auth.error} />;
  if (!auth.session) return <AuthPanel />;
  if (auth.passwordRecovery && auth.client) {
    return <PasswordResetPanel client={auth.client} onComplete={auth.finishPasswordRecovery} />;
  }

  const accountEmail = auth.session.user.email ?? "Student account";
  const firstName = metadataString(userMetadata, "first_name");
  const lastName = metadataString(userMetadata, "last_name");
  const greetingName = firstName || "there";
  const accountAvatarInitials = accountInitials(firstName, lastName, accountEmail);

  return (
    <main className="min-h-screen bg-[#edf2f4] text-[#102b3a]">
      <div className="mx-auto flex min-h-screen max-w-[1480px] gap-6 px-4 py-4 sm:px-6 lg:px-8">
        <aside className="hidden w-[238px] shrink-0 flex-col justify-between rounded-[28px] bg-[#0d2b3a] p-5 text-white lg:flex">
          <div>
            <button
              type="button"
              onClick={() => setView("planner")}
              className="flex items-start gap-3 rounded-2xl px-2 text-left outline-none ring-[#62d2be]/50 transition-opacity hover:opacity-90 focus-visible:ring-2"
              aria-label="Go to Planner"
            >
              <StudySyncLogo className="size-14 shadow-[0_10px_24px_rgb(98_210_190/22%)]" />
              <div className="pt-1">
                <p className="text-[17px] font-bold tracking-[-0.03em]">StudySync</p>
                <p className="mt-1 text-xs text-white/50">Your coursework, in sync</p>
              </div>
            </button>

            <div className="mt-12">
              <p className="px-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-white/40">
                Workspace
              </p>
              <div className="mt-3 space-y-1">
                <button
                  type="button"
                  onClick={() => setView("planner")}
                  className={`flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left text-sm font-semibold transition-colors ${view === "planner" ? "bg-white/10 text-white" : "text-white/60 hover:bg-white/[0.06] hover:text-white"}`}
                >
                  <LayoutDashboard className={`size-[18px] ${view === "planner" ? "text-[#62d2be]" : "text-white/50"}`} />
                  Planner
                </button>
                <button
                  type="button"
                  onClick={() => setView("calendar")}
                  className={`flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left text-sm font-semibold transition-colors ${view === "calendar" ? "bg-white/10 text-white" : "text-white/60 hover:bg-white/[0.06] hover:text-white"}`}
                >
                  <CalendarDays className={`size-[18px] ${view === "calendar" ? "text-[#62d2be]" : "text-white/50"}`} />
                  Calendar
                </button>
                <button
                  type="button"
                  onClick={() => setView("completed")}
                  className={`flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left text-sm font-semibold transition-colors ${view === "completed" ? "bg-white/10 text-white" : "text-white/60 hover:bg-white/[0.06] hover:text-white"}`}
                >
                  <CheckCircle2 className={`size-[18px] ${view === "completed" ? "text-[#62d2be]" : "text-white/50"}`} />
                  Completed
                </button>
                <button
                  type="button"
                  onClick={() => setView("reminders")}
                  className={`flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left text-sm font-semibold transition-colors ${view === "reminders" ? "bg-white/10 text-white" : "text-white/60 hover:bg-white/[0.06] hover:text-white"}`}
                >
                  <Bell className={`size-[18px] ${view === "reminders" ? "text-[#62d2be]" : "text-white/50"}`} />
                  Reminders
                </button>
                <button
                  type="button"
                  onClick={() => setView("account")}
                  className={`flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left text-sm font-semibold transition-colors ${view === "account" ? "bg-white/10 text-white" : "text-white/60 hover:bg-white/[0.06] hover:text-white"}`}
                >
                  <UserRound className={`size-[18px] ${view === "account" ? "text-[#62d2be]" : "text-white/50"}`} />
                  Account
                </button>
              </div>
            </div>
          </div>

          <div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.06] p-4">
              <div className="flex items-center gap-2 text-[#62d2be]">
                <CheckCircle2 className="size-4" />
                <span className="text-xs font-semibold">A clear place to start</span>
              </div>
              <p className="mt-2 text-xs leading-5 text-white/55">
                Add every deadline, including work that lives outside your LMS.
              </p>
            </div>
          </div>
        </aside>

        <div className="min-w-0 flex-1">
          <header className="flex items-center justify-between gap-4 px-1 py-2 sm:px-2 sm:py-3">
            <div className="flex items-center gap-2 lg:hidden">
              <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
                <SheetTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-11 rounded-2xl text-[#173746] hover:bg-white hover:text-[#0d2b3a]"
                    aria-label="Open navigation menu"
                  >
                    <Menu className="size-5" />
                  </Button>
                </SheetTrigger>
                <SheetContent
                  side="left"
                  className="w-[min(86vw,300px)] border-[#285263] bg-[#0d2b3a] p-0 text-white"
                >
                  <SheetHeader className="border-b border-white/10 px-5 py-5 text-left">
                    <SheetTitle className="text-left text-lg tracking-[-0.03em] text-white">StudySync</SheetTitle>
                    <SheetDescription className="text-left text-white/55">Your coursework, in sync</SheetDescription>
                  </SheetHeader>
                  <nav className="px-3 py-5" aria-label="Mobile workspace navigation">
                    <p className="px-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-white/40">
                      Workspace
                    </p>
                    <div className="mt-3 space-y-1">
                      {navigationItems.map((item) => {
                        const Icon = item.icon;
                        const active = view === item.id;
                        return (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => {
                              setView(item.id);
                              setMobileNavOpen(false);
                            }}
                            aria-current={active ? "page" : undefined}
                            className={`flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left text-sm font-semibold transition-colors ${active ? "bg-white/10 text-white" : "text-white/60 hover:bg-white/[0.06] hover:text-white"}`}
                          >
                            <Icon className={`size-[18px] ${active ? "text-[#62d2be]" : "text-white/50"}`} />
                            {item.label}
                          </button>
                        );
                      })}
                    </div>
                  </nav>
                </SheetContent>
              </Sheet>
              <button
                type="button"
                onClick={() => setView("planner")}
                className="flex items-center gap-3 rounded-2xl text-left outline-none ring-[#2f9584]/40 focus-visible:ring-2"
                aria-label="Go to Planner"
              >
                <StudySyncLogo className="size-12" />
                <p className="text-lg font-bold tracking-[-0.03em]">StudySync</p>
              </button>
            </div>
            <div className="hidden lg:block">
              <p className="text-sm font-medium text-[#6c8793]">{formatHeaderDate()}</p>
            </div>
            <div className="flex items-center gap-3">
              <div className="hidden text-right sm:block">
                <p className="max-w-[220px] truncate text-sm font-semibold text-[#193e4e]">Hi, {greetingName}</p>
                <p className="text-xs text-[#78909b]">Private planner</p>
              </div>
              <button
                type="button"
                onClick={() => setView("account")}
                className="flex size-10 items-center justify-center rounded-full bg-[#cceee7] text-sm font-bold text-[#176052] outline-none ring-[#2f9584]/40 transition-transform hover:scale-105 focus-visible:ring-2"
                aria-label="Open Account"
              >
                {accountAvatarInitials}
              </button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={signingOut}
                onClick={() => void handleSignOut()}
                className="h-9 rounded-xl px-2.5 text-[#52717c] hover:bg-white hover:text-[#173746]"
                aria-label="Sign out"
              >
                <LogOut className="size-4" />
                <span className="hidden md:inline">Sign out</span>
              </Button>
            </div>
          </header>

          <section className="px-1 pb-8 pt-6 sm:px-2 sm:pt-8">
            {view === "planner" ? (
              <>
            <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
              <div>
                <p className="mb-2 text-sm font-semibold text-[#2f9584]">{getGreeting()}</p>
                <h1 className="text-[clamp(2rem,4vw,3.3rem)] font-bold leading-[1.05] tracking-[-0.055em] text-[#102b3a]">
                  Here&apos;s your plan.
                </h1>
                <p className="mt-3 max-w-xl text-[15px] leading-6 text-[#66818c]">
                  Keep upcoming coursework visible, then decide what deserves your attention next.
                </p>
              </div>
              <div className="flex items-center gap-2 text-sm text-[#66818c]">
                <span className="size-2 rounded-full bg-[#55b7a5]" />
                Saved assignments stay with your planner
              </div>
            </div>

            <div className="mt-8 grid gap-4 sm:grid-cols-3">
              <Card className="gap-0 border-0 bg-white py-0 shadow-[0_10px_30px_rgb(16_43_58/5%)]">
                <CardContent className="flex items-center justify-between p-5">
                  <div>
                    <p className="text-sm font-medium text-[#718994]">Due today</p>
                    <p className="mt-2 text-3xl font-bold tracking-[-0.06em] text-[#102b3a]">
                      {dueToday.length}
                    </p>
                  </div>
                  <div className="flex size-11 items-center justify-center rounded-2xl bg-[#fff1ef] text-[#d76356]">
                    <CalendarDays className="size-5" />
                  </div>
                </CardContent>
              </Card>
              <Card className="gap-0 border-0 bg-white py-0 shadow-[0_10px_30px_rgb(16_43_58/5%)]">
                <CardContent className="flex items-center justify-between p-5">
                  <div>
                    <p className="text-sm font-medium text-[#718994]">On your list</p>
                    <p className="mt-2 text-3xl font-bold tracking-[-0.06em] text-[#102b3a]">
                      {activeAssignments.length}
                    </p>
                  </div>
                  <div className="flex size-11 items-center justify-center rounded-2xl bg-[#edf8f6] text-[#2f9584]">
                    <ListTodo className="size-5" />
                  </div>
                </CardContent>
              </Card>
              <Card className="gap-0 border-0 bg-white py-0 shadow-[0_10px_30px_rgb(16_43_58/5%)]">
                <CardContent className="flex items-center justify-between p-5">
                  <div>
                    <div className="flex items-center gap-1.5">
                      <p className="text-sm font-medium text-[#718994]">Estimated study</p>
                      <Select
                        value={studyRange}
                        onValueChange={(value) => setStudyRange(value as StudyRange)}
                      >
                        <SelectTrigger
                          aria-label="Estimated study range"
                          className="h-5 w-auto gap-1 rounded-full border-none bg-[#fff8e8] px-2 py-0 text-[11px] font-semibold text-[#c08b25] shadow-none hover:bg-[#fdefce] focus-visible:ring-[#c08b25]/25 [&_svg]:size-3"
                        >
                          <SelectValue>{STUDY_RANGE_LABELS[studyRange]}</SelectValue>
                        </SelectTrigger>
                        <SelectContent align="start">
                          <SelectItem value="day">Day</SelectItem>
                          <SelectItem value="week">Week</SelectItem>
                          <SelectItem value="all">All</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <p className="mt-2 text-3xl font-bold tracking-[-0.06em] text-[#102b3a]">
                      {formatStudyTime(estimatedMinutes)}
                    </p>
                  </div>
                  <div className="flex size-11 items-center justify-center rounded-2xl bg-[#fff8e8] text-[#c08b25]">
                    <Clock3 className="size-5" />
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="mt-5 grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
              <Card className="overflow-hidden border-0 bg-white py-0 shadow-[0_12px_34px_rgb(16_43_58/6%)]">
                <CardHeader className="border-b border-[#e6eef0] px-5 py-5 sm:px-6">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <CardTitle className="text-xl tracking-[-0.035em] text-[#173746]">
                        Upcoming assignments
                      </CardTitle>
                      <CardDescription className="mt-1.5 text-[#78909b]">
                        Your next deadlines, ordered by when they arrive.
                      </CardDescription>
                    </div>
                    <div className="hidden items-center gap-2 rounded-full bg-[#edf8f6] px-3 py-1.5 text-xs font-semibold text-[#2f9584] sm:flex">
                      <BookOpen className="size-3.5" />
                      {activeAssignments.length ? "In progress" : "Ready when you are"}
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="px-0">
                  {overdueAssignments.length ? (
                    <div className="mx-5 mt-5 flex items-start gap-3 rounded-2xl border border-[#f3b1a9] bg-[#fff1ef] px-4 py-3.5 text-[#a93e35] sm:mx-6">
                      <AlertTriangle className="mt-0.5 size-5 shrink-0" />
                      <div>
                        <p className="text-sm font-bold">
                          {overdueAssignments.length === 1
                            ? "1 assignment is overdue"
                            : `${overdueAssignments.length} assignments are overdue`}
                        </p>
                        <p className="mt-1 text-xs leading-5 text-[#b05249]">
                          Overdue work is shown first so it is easier to catch up.
                        </p>
                      </div>
                    </div>
                  ) : null}

                  <section
                    className="mx-5 mt-5 overflow-hidden rounded-[22px] border-2 border-[#b8d3d7] bg-[#fbfefe] shadow-[0_6px_18px_rgb(16_43_58/4%)] sm:mx-6"
                    aria-labelledby="upcoming-list-heading"
                  >
                    <div className="flex items-center justify-between gap-3 border-b border-[#dce9eb] bg-[#f0f8f6] px-4 py-3.5">
                      <div className="flex items-center gap-2">
                        <span className="flex size-7 items-center justify-center rounded-lg bg-[#d3f1eb] text-[#176052]">
                          <CalendarDays className="size-4" />
                        </span>
                        <h2 id="upcoming-list-heading" className="text-sm font-bold text-[#173746]">Next up</h2>
                      </div>
                      <span className="text-xs font-semibold text-[#52717c]">
                        {sortedAssignments.length} {sortedAssignments.length === 1 ? "assignment" : "assignments"}
                      </span>
                    </div>

                  {loading ? (
                    <div className="space-y-4 px-5 py-8 sm:px-6" aria-busy="true">
                      {["w-3/4", "w-2/3", "w-4/5"].map((width) => (
                        <div key={width} className="flex gap-4">
                          <span className="h-12 w-1 rounded-full bg-[#dbe8ea]" />
                          <div className="flex-1 space-y-3">
                            <span className={`block h-4 ${width} animate-pulse rounded-full bg-[#edf2f4]`} />
                            <span className="block h-3 w-1/3 animate-pulse rounded-full bg-[#f2f5f6]" />
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : sortedAssignments.length ? (
                    <div>
                      {sortedAssignments.map((assignment) => {
                        const overdue = isOverdue(assignment.dueAt);
                        const courseColor = getCourseColor(assignment.course, courseColors);
                        return (
                          <article
                            key={assignment.id}
                            className="flex gap-4 border-b border-[#edf2f4] px-5 py-5 last:border-b-0 sm:px-6"
                          >
                            <Checkbox
                              checked={false}
                              disabled={completingId !== null}
                              onCheckedChange={(checked) => {
                                if (checked === true) setAssignmentToComplete(assignment);
                              }}
                              aria-label={`Mark ${assignment.title} as complete`}
                              title="Mark assignment complete"
                              className="mt-1 size-5 rounded-full border-2 border-[#b8d3d7] text-[#0d2b3a] shadow-none hover:border-[#2f9584] data-[state=checked]:border-[#62d2be] data-[state=checked]:bg-[#62d2be] focus-visible:border-[#2f9584] focus-visible:ring-[#62d2be]/40"
                            />
                            <span
                              className="mt-0.5 h-[62px] w-1 shrink-0 rounded-full"
                              style={{ backgroundColor: courseColor }}
                            />
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <h2 className="min-w-0 flex-1 truncate text-[15px] font-semibold text-[#173746]">
                                  {assignment.title}
                                </h2>
                                {overdue ? (
                                  <Badge variant="outline" className="border-[#f39a8e] bg-[#fff0ed] font-bold uppercase tracking-[0.08em] text-[#b52f25]">
                                    Overdue
                                  </Badge>
                                ) : null}
                              </div>
                              <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-[#78909b]">
                                <span className="inline-flex items-center gap-2 font-medium text-[#52717c]">
                                  <span
                                    className="size-2.5 rounded-full border border-black/10"
                                    style={{ backgroundColor: courseColor }}
                                    aria-hidden="true"
                                  />
                                  {assignment.course}
                                </span>
                                <span className="inline-flex items-center gap-1.5">
                                  <CalendarDays className={`size-3.5 ${overdue ? "text-[#d64034]" : ""}`} />
                                  {overdue ? (
                                    <>
                                      <span className="font-semibold text-[#b52f25]">Overdue</span>
                                      <span aria-hidden="true">·</span>
                                    </>
                                  ) : null}
                                  {formatDueDate(assignment.dueAt)} at {formatDueTime(assignment.dueAt)}
                                </span>
                                <span className="inline-flex items-center gap-1.5">
                                  <Clock3 className="size-3.5" />
                                  {formatStudyTime(assignment.estimatedMinutes)}
                                </span>
                              </div>
                            </div>
                          </article>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center px-6 py-14 text-center">
                      <div className="flex size-14 items-center justify-center rounded-[20px] bg-[#edf8f6] text-[#2f9584]">
                        <ListTodo className="size-6" />
                      </div>
                      <h2 className="mt-5 text-lg font-semibold tracking-[-0.025em] text-[#173746]">
                        Your planner is clear.
                      </h2>
                      <p className="mt-2 max-w-sm text-sm leading-6 text-[#78909b]">
                        Add your next deadline using the form, and it will appear here in due-date order.
                      </p>
                    </div>
                  )}
                  </section>

                  {recentlyCompletedAssignments.length ? (
                    <section className="mx-5 mt-5 overflow-hidden rounded-2xl border border-[#d8e4e7] bg-[#f8fbfb] sm:mx-6">
                      <div className="flex items-start justify-between gap-4 px-5 py-5 sm:px-6">
                        <div>
                          <h2 className="text-base font-semibold tracking-[-0.02em] text-[#173746]">
                            Recently completed
                          </h2>
                          <p className="mt-1 text-sm leading-5 text-[#78909b]">
                            Completed in the last 7 days. Add one back if you need it.
                          </p>
                        </div>
                        <Badge variant="outline" className="border-[#a9d9cf] bg-[#eefbf7] text-[#287568]">
                          {recentlyCompletedAssignments.length}
                        </Badge>
                      </div>
                      <div className="divide-y divide-[#edf2f4]">
                        {recentlyCompletedAssignments.map((assignment) => (
                          <div
                            key={assignment.id}
                            className="flex items-center gap-3 px-5 py-4 sm:px-6"
                          >
                            <div
                              className="flex size-8 shrink-0 items-center justify-center rounded-full text-[#173746]"
                              style={{ backgroundColor: getCourseColor(assignment.course, courseColors) }}
                            >
                              <CheckCircle2 className="size-4" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-semibold text-[#173746]">
                                {assignment.title}
                              </p>
                              <p className="mt-1 inline-flex items-center gap-2 text-xs text-[#78909b]">
                                <span
                                  className="size-2 rounded-full border border-black/10"
                                  style={{ backgroundColor: getCourseColor(assignment.course, courseColors) }}
                                  aria-hidden="true"
                                />
                                {assignment.course} · completed {formatCompletedDate(assignment.updatedAt)}
                              </p>
                            </div>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              disabled={restoringId !== null}
                              onClick={() => void handleRestore(assignment)}
                              className="shrink-0 rounded-xl border-[#c8dfe0] bg-white text-[#287568] hover:bg-[#eefbf7] hover:text-[#176052]"
                            >
                              {restoringId === assignment.id ? "Adding…" : "Add back"}
                            </Button>
                          </div>
                        ))}
                      </div>
                    </section>
                  ) : null}
                </CardContent>
              </Card>

              <div className="space-y-5">
                <Card className="border-0 bg-white py-0 shadow-[0_12px_34px_rgb(16_43_58/6%)]">
                  <CardHeader className="px-5 pb-2 pt-5 sm:px-6 sm:pt-6">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <CardTitle className="text-xl tracking-[-0.035em] text-[#173746]">Canvas</CardTitle>
                        <CardDescription className="mt-1.5 text-[#78909b]">
                          Bring your class assignments into StudySync.
                        </CardDescription>
                      </div>
                      <div className="flex size-10 items-center justify-center rounded-2xl bg-[#edf8f6] text-[#2f9584]">
                        <Link2 className="size-5" />
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="px-5 pb-5 pt-4 sm:px-6">
                    <div className="flex items-center gap-2 rounded-full border border-[#d8e4e7] bg-[#f7fafb] px-3 py-1.5 text-xs font-semibold text-[#52717c]">
                      <span className="size-2 rounded-full bg-[#e8b84d]" />
                      Coming soon
                    </div>
                    <p className="mt-4 text-sm leading-6 text-[#78909b]">
                      We’re working on a secure Canvas connection. For now, add assignments manually below.
                    </p>
                  </CardContent>
                </Card>
                <Card className="border-0 bg-[#0d2b3a] py-0 text-white shadow-[0_14px_36px_rgb(13_43_58/18%)]">
                  <CardHeader className="px-5 pb-2 pt-5 sm:px-6 sm:pt-6">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <CardTitle className="text-xl tracking-[-0.035em] text-white">Add an assignment</CardTitle>
                      <CardDescription className="mt-1.5 text-white/55">
                        Capture the details you need to plan.
                      </CardDescription>
                    </div>
                    <div className="flex size-10 items-center justify-center rounded-2xl bg-[#1b4a5b] text-[#62d2be]">
                      <Plus className="size-5" />
                    </div>
                  </div>
                  </CardHeader>
                  <CardContent className="px-5 pb-6 pt-4 sm:px-6">
                  <form className="space-y-4" onSubmit={handleSubmit}>
                    <div className="space-y-2">
                      <Label htmlFor="assignment-title" className="text-white/70">Assignment</Label>
                      <Input
                        id="assignment-title"
                        required
                        value={form.title}
                        onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
                        placeholder="e.g. Research paper outline"
                        className="border-white/15 bg-white/[0.08] text-white placeholder:text-white/35 focus-visible:border-[#62d2be] focus-visible:ring-[#62d2be]/30"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="assignment-course" className="text-white/70">Course</Label>
                      <Input
                        id="assignment-course"
                        required
                        value={form.course}
                        onChange={(event) => {
                          const course = event.target.value;
                          setForm((current) => ({
                            ...current,
                            course,
                            courseColor: courseColors[courseColorKey(course)] ?? current.courseColor,
                          }));
                        }}
                        placeholder="e.g. CS 401"
                        className="border-white/15 bg-white/[0.08] text-white placeholder:text-white/35 focus-visible:border-[#62d2be] focus-visible:ring-[#62d2be]/30"
                      />
                    </div>

                    <AssignmentFields
                      form={form}
                      idPrefix="assignment"
                      dark
                      onChange={(updates) => setForm((current) => ({ ...current, ...updates }))}
                    />

                    {error ? (
                      <p className="rounded-xl border border-[#f29f95]/30 bg-[#f29f95]/10 px-3 py-2.5 text-sm leading-5 text-[#ffc2ba]" role="alert">
                        {error}
                      </p>
                    ) : null}
                    {notice ? (
                      <p className="rounded-xl border border-[#62d2be]/25 bg-[#62d2be]/10 px-3 py-2.5 text-sm leading-5 text-[#a8eee1]" role="status">
                        {notice}
                      </p>
                    ) : null}

                    <Button
                      type="submit"
                      disabled={saving}
                      className="mt-1 h-11 w-full rounded-xl bg-[#62d2be] font-semibold text-[#0d2b3a] shadow-[0_8px_18px_rgb(98_210_190/18%)] hover:bg-[#7bdfce]"
                    >
                      {saving ? "Saving assignment…" : "Add to planner"}
                      {!saving ? <Plus className="size-4" /> : null}
                    </Button>
                  </form>

                  <div className="mt-5 flex items-center justify-between border-t border-white/10 pt-4 text-xs text-white/45">
                    <span>Need to refresh?</span>
                    <button
                      type="button"
                      onClick={() => void loadAssignments()}
                      className="inline-flex items-center gap-1.5 font-semibold text-[#a8eee1] transition-colors hover:text-white"
                    >
                      <RefreshCw className="size-3.5" />
                      Reload list
                    </button>
                  </div>
                  </CardContent>
                </Card>
              </div>
            </div>
              </>
            ) : view === "calendar" ? (
              <CalendarView assignments={assignments} courseColors={courseColors} onEdit={openEditDialog} />
            ) : view === "completed" ? (
              <CompletedView
                assignments={assignments}
                courseColors={courseColors}
                restoringId={restoringId}
                onRestore={(assignment, editAfterRestore) => void handleRestore(assignment, editAfterRestore)}
              />
            ) : view === "reminders" && accountClient ? (
              <RemindersView
                client={accountClient}
                email={accountEmail}
                metadata={userMetadata}
                accessToken={accessToken}
              />
            ) : accountClient ? (
              <AccountView client={accountClient} email={accountEmail} metadata={userMetadata} />
            ) : (
              <p className="rounded-2xl border border-[#f29f95] bg-[#fff1ef] px-4 py-3 text-sm text-[#a93e35]">
                Account settings are unavailable right now. Please refresh and try again.
              </p>
            )}
          </section>
        </div>
      </div>

      <AlertDialog
        open={assignmentToComplete !== null}
        onOpenChange={(open) => {
          if (!open) setAssignmentToComplete(null);
        }}
      >
        <AlertDialogContent className="border-[#d8e4e7] bg-white text-[#173746]">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-[#173746]">Mark this assignment complete?</AlertDialogTitle>
            <AlertDialogDescription className="leading-6 text-[#78909b]">
              {assignmentToComplete
                ? `${assignmentToComplete.title} will be marked complete and moved to Recently completed. You can add it back within 7 days.`
                : "This assignment will be marked complete."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={completingId !== null}
              onClick={() => {
                if (assignmentToComplete) openEditDialog(assignmentToComplete);
              }}
              className="border-[#c8dfe0] text-[#287568] hover:bg-[#eefbf7] hover:text-[#176052]"
            >
              <Pencil className="size-4" />
              Edit assignment
            </Button>
            <AlertDialogCancel
              disabled={completingId !== null}
              className="border-[#d8e4e7] text-[#52717c] hover:bg-[#edf2f4]"
            >
              Keep it
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={completingId !== null}
              onClick={(event) => {
                event.preventDefault();
                void confirmComplete();
              }}
              className="bg-[#0d2b3a] text-white hover:bg-[#173f50]"
            >
              {completingId !== null ? "Saving…" : "Yes, mark complete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog
        open={editing !== null}
        onOpenChange={(open) => {
          if (!editSaving && !open) setEditing(null);
        }}
      >
        <DialogContent className="max-h-[calc(100vh-2rem)] overflow-y-auto border-[#d8e4e7] bg-white text-[#173746] sm:max-w-xl">
          <form onSubmit={handleEditSubmit}>
            <DialogHeader>
              <DialogTitle className="text-2xl tracking-[-0.04em] text-[#173746]">Edit assignment</DialogTitle>
              <DialogDescription className="leading-6 text-[#78909b]">
                Update the details for this assignment. Its class color will be used across the course.
              </DialogDescription>
            </DialogHeader>

            <div className="mt-5 space-y-5">
              <div className="space-y-2">
                <Label htmlFor="edit-assignment-title" className="text-[#52717c]">Assignment</Label>
                <Input
                  id="edit-assignment-title"
                  required
                  value={editForm.title}
                  onChange={(event) => setEditForm((current) => ({ ...current, title: event.target.value }))}
                  className="h-11 border-[#d8e4e7] text-[#173746] placeholder:text-[#a9b9be] focus-visible:border-[#62b2a5] focus-visible:ring-[#62b2be]/25"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-assignment-course" className="text-[#52717c]">Course</Label>
                  <Input
                    id="edit-assignment-course"
                    required
                    value={editForm.course}
                  onChange={(event) => {
                    const course = event.target.value;
                    setEditForm((current) => ({
                      ...current,
                      course,
                      courseColor: courseColors[courseColorKey(course)] ?? current.courseColor,
                    }));
                  }}
                  className="h-11 border-[#d8e4e7] text-[#173746] placeholder:text-[#a9b9be] focus-visible:border-[#62b2a5] focus-visible:ring-[#62b2be]/25"
                />
              </div>

              <AssignmentFields
                form={editForm}
                idPrefix="edit-assignment"
                onChange={(updates) => setEditForm((current) => ({ ...current, ...updates }))}
              />
            </div>

            {error ? (
              <p className="mt-5 rounded-xl border border-[#f29f95] bg-[#fff1ef] px-3 py-2.5 text-sm leading-5 text-[#a93e35]" role="alert">
                {error}
              </p>
            ) : null}

            <DialogFooter className="mt-6">
              <Button
                type="button"
                variant="outline"
                disabled={editSaving}
                onClick={() => setEditing(null)}
                className="border-[#d8e4e7] text-[#52717c] hover:bg-[#edf2f4]"
              >
                Cancel
              </Button>
              <Button type="submit" disabled={editSaving} className="bg-[#0d2b3a] text-white hover:bg-[#173f50]">
                {editSaving ? "Saving…" : "Save changes"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </main>
  );
}
