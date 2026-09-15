"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Check, Link2, LoaderCircle, LockKeyhole, RefreshCw, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
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

type CanvasConnection = {
  connected: true;
  baseUrl: string;
  canvasUserName: string | null;
  updatedAt: string;
};

type CanvasCourse = {
  id: string;
  name: string;
  courseCode: string | null;
};

type CanvasConnectCardProps = {
  accessToken: string;
  onImported: () => Promise<void> | void;
};

export function CanvasConnectCard({ accessToken, onImported }: CanvasConnectCardProps) {
  const [connection, setConnection] = useState<CanvasConnection | null>(null);
  const [loadingConnection, setLoadingConnection] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogStep, setDialogStep] = useState<"connect" | "import">("connect");
  const [baseUrl, setBaseUrl] = useState("");
  const [canvasToken, setCanvasToken] = useState("");
  const [courses, setCourses] = useState<CanvasCourse[]>([]);
  const [selectedCourseIds, setSelectedCourseIds] = useState<string[]>([]);
  const [importMode, setImportMode] = useState<"all" | "selected">("all");
  const [loadingCourses, setLoadingCourses] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function canvasFetch<T>(path: string, init?: RequestInit) {
    const response = await fetch(path, {
      ...init,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        ...(init?.headers ?? {}),
      },
    });
    const payload = (await response.json()) as T & { error?: string };
    if (!response.ok) throw new Error(payload.error ?? "Canvas could not complete that request.");
    return payload;
  }

  async function loadConnection() {
    setLoadingConnection(true);
    try {
      const payload = await canvasFetch<{ connection: CanvasConnection | null }>('/api/canvas/connection');
      setConnection(payload.connection);
      if (payload.connection) setBaseUrl(payload.connection.baseUrl);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not load Canvas connection.");
    } finally {
      setLoadingConnection(false);
    }
  }

  useEffect(() => {
    if (!accessToken) return;
    const reloadTimer = window.setTimeout(() => {
      void loadConnection();
    }, 0);

    return () => window.clearTimeout(reloadTimer);
  }, [accessToken]);

  async function loadCourses() {
    setLoadingCourses(true);
    setError("");
    try {
      const payload = await canvasFetch<{ courses: CanvasCourse[] }>('/api/canvas/courses');
      setCourses(payload.courses);
      setSelectedCourseIds([]);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not load Canvas classes.");
    } finally {
      setLoadingCourses(false);
    }
  }

  function openConnectDialog() {
    setDialogStep("connect");
    setCanvasToken("");
    setError("");
    setNotice("");
    setDialogOpen(true);
  }

  function openImportDialog() {
    setDialogStep("import");
    setImportMode("all");
    setSelectedCourseIds([]);
    setError("");
    setNotice("");
    setDialogOpen(true);
    void loadCourses();
  }

  async function handleConnect(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setConnecting(true);
    setError("");
    setNotice("");

    try {
      const payload = await canvasFetch<{ connection: CanvasConnection }>("/api/canvas/connection", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ baseUrl, accessToken: canvasToken }),
      });
      setConnection(payload.connection);
      setBaseUrl(payload.connection.baseUrl);
      setCanvasToken("");
      setDialogStep("import");
      await loadCourses();
    } catch (connectError) {
      setError(connectError instanceof Error ? connectError.message : "Could not connect Canvas.");
    } finally {
      setConnecting(false);
    }
  }

  async function handleImport() {
    if (importMode === "selected" && selectedCourseIds.length === 0) {
      setError("Choose at least one Canvas class to import.");
      return;
    }

    setImporting(true);
    setError("");
    setNotice("");
    try {
      const payload = await canvasFetch<{
        imported: number;
        updated: number;
        skipped: number;
        courses: number;
      }>("/api/canvas/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: importMode, courseIds: selectedCourseIds }),
      });
      await onImported();
      setNotice(
        `${payload.imported} new ${payload.imported === 1 ? "assignment" : "assignments"} added from ${payload.courses} ${payload.courses === 1 ? "class" : "classes"}${payload.updated ? `, ${payload.updated} updated` : ""}${payload.skipped ? ` ${payload.skipped} without due dates skipped.` : "."}`,
      );
      setDialogOpen(false);
    } catch (importError) {
      setError(importError instanceof Error ? importError.message : "Could not import Canvas assignments.");
    } finally {
      setImporting(false);
    }
  }

  async function handleDisconnect() {
    if (!window.confirm("Disconnect Canvas from StudySync? Your imported assignments will stay in your planner.")) {
      return;
    }

    setDisconnecting(true);
    setError("");
    setNotice("");
    try {
      await canvasFetch<{ disconnected: true }>("/api/canvas/connection", { method: "DELETE" });
      setConnection(null);
      setCourses([]);
      setNotice("Canvas disconnected. Your imported assignments are still saved.");
    } catch (disconnectError) {
      setError(disconnectError instanceof Error ? disconnectError.message : "Could not disconnect Canvas.");
    } finally {
      setDisconnecting(false);
    }
  }

  function toggleCourse(courseId: string, checked: boolean) {
    setSelectedCourseIds((current) =>
      checked
        ? current.includes(courseId) ? current : [...current, courseId]
        : current.filter((id) => id !== courseId),
    );
  }

  const allCoursesSelected = courses.length > 0 && selectedCourseIds.length === courses.length;

  return (
    <>
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
          {loadingConnection ? (
            <div className="flex items-center gap-2 text-sm text-[#78909b]" aria-busy="true">
              <LoaderCircle className="size-4 animate-spin text-[#2f9584]" />
              Checking Canvas connection…
            </div>
          ) : connection ? (
            <div className="space-y-4">
              <div className="flex items-start gap-3 rounded-2xl border border-[#a9d9cf] bg-[#eefbf7] px-3.5 py-3">
                <ShieldCheck className="mt-0.5 size-5 shrink-0 text-[#2f9584]" />
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-[#176052]">Canvas connected</p>
                  <p className="mt-1 truncate text-xs text-[#52717c]">
                    {connection.canvasUserName || "Canvas account"} · {connection.baseUrl.replace(/\/$/, "")}
                  </p>
                </div>
              </div>
              <Button
                type="button"
                onClick={openImportDialog}
                className="h-11 w-full rounded-xl bg-[#0d2b3a] font-semibold text-white hover:bg-[#173f50]"
              >
                Import assignments
                <RefreshCw className="size-4" />
              </Button>
              <div className="flex items-center justify-between gap-3 text-xs">
                <button
                  type="button"
                  onClick={openConnectDialog}
                  className="font-semibold text-[#2f9584] hover:text-[#176052]"
                >
                  Reconnect
                </button>
                <button
                  type="button"
                  onClick={() => void handleDisconnect()}
                  disabled={disconnecting}
                  className="font-semibold text-[#9b7772] hover:text-[#a93e35]"
                >
                  {disconnecting ? "Disconnecting…" : "Disconnect"}
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-start gap-3 rounded-2xl border border-[#d8e4e7] bg-[#f7fafb] px-3.5 py-3">
                <LockKeyhole className="mt-0.5 size-5 shrink-0 text-[#2f9584]" />
                <p className="text-sm leading-5 text-[#52717c]">
                  Connect your account to import assignments from every class or only the classes you choose.
                </p>
              </div>
              <Button
                type="button"
                onClick={openConnectDialog}
                className="h-11 w-full rounded-xl bg-[#0d2b3a] font-semibold text-white hover:bg-[#173f50]"
              >
                Connect Canvas
                <Link2 className="size-4" />
              </Button>
            </div>
          )}

          {error ? (
            <p className="mt-4 rounded-xl border border-[#f29f95] bg-[#fff1ef] px-3 py-2.5 text-sm leading-5 text-[#a93e35]" role="alert">
              {error}
            </p>
          ) : null}
          {notice ? (
            <p className="mt-4 rounded-xl border border-[#a9d9cf] bg-[#eefbf7] px-3 py-2.5 text-sm leading-5 text-[#287568]" role="status">
              {notice}
            </p>
          ) : null}
        </CardContent>
      </Card>

      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          if (!connecting && !importing) setDialogOpen(open);
        }}
      >
        <DialogContent className="max-h-[calc(100vh-2rem)] overflow-y-auto border-[#d8e4e7] bg-white text-[#173746] sm:max-w-xl">
          {dialogStep === "connect" ? (
            <form onSubmit={handleConnect}>
              <DialogHeader>
                <DialogTitle className="text-2xl tracking-[-0.04em] text-[#173746]">Connect Canvas</DialogTitle>
                <DialogDescription className="leading-6 text-[#78909b]">
                  Use your school’s Canvas address and a personal access token. StudySync checks the connection, then encrypts the token before saving it.
                </DialogDescription>
              </DialogHeader>

              <div className="mt-5 space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="canvas-url" className="text-[#52717c]">School Canvas URL</Label>
                  <Input
                    id="canvas-url"
                    required
                    type="url"
                    value={baseUrl}
                    onChange={(event) => setBaseUrl(event.target.value)}
                    placeholder="https://your-school.instructure.com"
                    className="h-11 border-[#d8e4e7] text-[#173746] placeholder:text-[#a9b9be] focus-visible:border-[#62b2a5] focus-visible:ring-[#62b2be]/25"
                  />
                  <p className="text-xs leading-5 text-[#78909b]">Enter only the main Canvas address, not a course link.</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="canvas-token" className="text-[#52717c]">Canvas access token</Label>
                  <Input
                    id="canvas-token"
                    required
                    type="password"
                    autoComplete="off"
                    value={canvasToken}
                    onChange={(event) => setCanvasToken(event.target.value)}
                    placeholder="Paste your Canvas token"
                    className="h-11 border-[#d8e4e7] text-[#173746] placeholder:text-[#a9b9be] focus-visible:border-[#62b2a5] focus-visible:ring-[#62b2be]/25"
                  />
                  <p className="flex items-start gap-1.5 text-xs leading-5 text-[#78909b]">
                    <LockKeyhole className="mt-0.5 size-3.5 shrink-0 text-[#2f9584]" />
                    Your token is used only by the server and is never returned to the browser after connecting.
                  </p>
                </div>
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
                  disabled={connecting}
                  onClick={() => setDialogOpen(false)}
                  className="border-[#d8e4e7] text-[#52717c] hover:bg-[#edf2f4]"
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={connecting} className="bg-[#0d2b3a] text-white hover:bg-[#173f50]">
                  {connecting ? <LoaderCircle className="size-4 animate-spin" /> : <ShieldCheck className="size-4" />}
                  {connecting ? "Checking Canvas…" : "Connect securely"}
                </Button>
              </DialogFooter>
            </form>
          ) : (
            <div>
              <DialogHeader>
                <DialogTitle className="text-2xl tracking-[-0.04em] text-[#173746]">Import Canvas assignments</DialogTitle>
                <DialogDescription className="leading-6 text-[#78909b]">
                  Choose whether StudySync should import every active class or only the classes you select.
                </DialogDescription>
              </DialogHeader>

              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                {([
                  ["all", "All active classes", "Import assignments from every active Canvas class."],
                  ["selected", "Choose specific classes", "Pick the classes you want to add."],
                ] as const).map(([value, title, description]) => {
                  const selected = importMode === value;
                  return (
                    <button
                      key={value}
                      type="button"
                      aria-pressed={selected}
                      onClick={() => setImportMode(value)}
                      className={`rounded-2xl border px-4 py-3 text-left transition-colors ${selected ? "border-[#2f9584] bg-[#eefbf7]" : "border-[#d8e4e7] bg-white hover:bg-[#f7fafb]"}`}
                    >
                      <span className="flex items-center justify-between gap-3">
                        <span className="text-sm font-semibold text-[#173746]">{title}</span>
                        <span className={`flex size-5 items-center justify-center rounded-full border ${selected ? "border-[#2f9584] bg-[#2f9584] text-white" : "border-[#b8d3d7] text-transparent"}`}>
                          <Check className="size-3.5" />
                        </span>
                      </span>
                      <span className="mt-1 block text-xs leading-5 text-[#78909b]">{description}</span>
                    </button>
                  );
                })}
              </div>

              {importMode === "selected" ? (
                <div className="mt-5 rounded-2xl border border-[#d8e4e7] bg-[#f7fafb] p-3.5">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-[#173746]">Active classes</p>
                    {courses.length ? (
                      <button
                        type="button"
                        onClick={() => setSelectedCourseIds(allCoursesSelected ? [] : courses.map((course) => course.id))}
                        className="text-xs font-semibold text-[#2f9584] hover:text-[#176052]"
                      >
                        {allCoursesSelected ? "Clear all" : "Select all"}
                      </button>
                    ) : null}
                  </div>
                  {loadingCourses ? (
                    <div className="mt-4 flex items-center gap-2 text-sm text-[#78909b]" aria-busy="true">
                      <LoaderCircle className="size-4 animate-spin text-[#2f9584]" />
                      Loading your Canvas classes…
                    </div>
                  ) : courses.length ? (
                    <div className="mt-3 max-h-56 space-y-2 overflow-y-auto pr-1">
                      {courses.map((course) => (
                        <label
                          key={course.id}
                          className="flex cursor-pointer items-start gap-3 rounded-xl border border-transparent bg-white px-3 py-2.5 hover:border-[#a9d9cf]"
                        >
                          <Checkbox
                            checked={selectedCourseIds.includes(course.id)}
                            onCheckedChange={(checked) => toggleCourse(course.id, checked === true)}
                            aria-label={`Select ${course.name}`}
                            className="mt-0.5 border-[#b8d3d7] text-[#0d2b3a] data-[state=checked]:border-[#2f9584] data-[state=checked]:bg-[#2f9584] focus-visible:ring-[#62d2be]/40"
                          />
                          <span className="min-w-0">
                            <span className="block truncate text-sm font-medium text-[#173746]">{course.name}</span>
                            {course.courseCode && course.courseCode !== course.name ? (
                              <span className="mt-0.5 block text-xs text-[#78909b]">{course.courseCode}</span>
                            ) : null}
                          </span>
                        </label>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-3 text-sm leading-5 text-[#78909b]">No active Canvas classes were found.</p>
                  )}
                </div>
              ) : (
                <div className="mt-5 flex items-start gap-3 rounded-2xl border border-[#a9d9cf] bg-[#eefbf7] px-3.5 py-3">
                  <ShieldCheck className="mt-0.5 size-5 shrink-0 text-[#2f9584]" />
                  <p className="text-sm leading-5 text-[#52717c]">
                    StudySync will import assignments with due dates from all of your active Canvas classes. Existing Canvas assignments will be updated instead of duplicated.
                  </p>
                </div>
              )}

              {error ? (
                <p className="mt-5 rounded-xl border border-[#f29f95] bg-[#fff1ef] px-3 py-2.5 text-sm leading-5 text-[#a93e35]" role="alert">
                  {error}
                </p>
              ) : null}

              <DialogFooter className="mt-6">
                <Button
                  type="button"
                  variant="outline"
                  disabled={importing}
                  onClick={() => setDialogOpen(false)}
                  className="border-[#d8e4e7] text-[#52717c] hover:bg-[#edf2f4]"
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  disabled={importing || loadingCourses || (importMode === "selected" && selectedCourseIds.length === 0)}
                  onClick={() => void handleImport()}
                  className="bg-[#0d2b3a] text-white hover:bg-[#173f50]"
                >
                  {importing ? <LoaderCircle className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
                  {importing ? "Importing…" : importMode === "all" ? "Import all assignments" : "Import selected classes"}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
