import { useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/sites";
import { siteIsNavigable, type StoredSite } from "@/lib/siteTypes";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
import { Lock, Plus, Map as MapIcon, Trash2, ChevronRight, LogOut, QrCode } from "lucide-react";

function LoginScreen({ onSuccess }: { onSuccess: () => void }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!password || busy) return;
    setBusy(true);
    setError(null);
    try {
      await api("/admin/login", { method: "POST", body: JSON.stringify({ password }) });
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-[100dvh] flex flex-col items-center justify-center bg-background p-6 safe-area-pt safe-area-pb">
      <div className="w-full max-w-sm">
        <div className="w-16 h-16 bg-primary/10 rounded-3xl flex items-center justify-center mb-6 mx-auto border border-primary/20">
          <Lock className="w-8 h-8 text-primary" />
        </div>
        <h1 className="text-3xl font-extrabold tracking-tight text-center mb-2">Wayfinder Admin</h1>
        <p className="text-muted-foreground text-center mb-8">Enter the admin password to manage sites.</p>
        <Input
          type="password"
          value={password}
          onChange={(e) => {
            setPassword(e.target.value);
            setError(null);
          }}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          placeholder="Admin password"
          className="h-14 rounded-2xl text-base mb-3"
          autoFocus
          data-testid="input-admin-password"
        />
        {error && <p className="text-sm font-medium text-destructive mb-3 px-1">{error}</p>}
        <Button
          size="lg"
          className="w-full h-14 rounded-2xl text-lg"
          onClick={submit}
          disabled={!password || busy}
          data-testid="button-admin-login"
        >
          {busy ? "Signing in..." : "Sign In"}
        </Button>
      </div>
    </div>
  );
}

export default function AdminHome() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const [newName, setNewName] = useState("");
  const [deleting, setDeleting] = useState<StoredSite | null>(null);

  const me = useQuery({
    queryKey: ["admin-me"],
    queryFn: () => api<{ authenticated: boolean }>("/admin/me"),
  });

  const sites = useQuery({
    queryKey: ["admin-sites"],
    queryFn: () => api<{ sites: StoredSite[] }>("/admin/sites"),
    enabled: me.data?.authenticated === true,
  });

  const createSite = useMutation({
    mutationFn: (name: string) =>
      api<{ site: StoredSite }>("/admin/sites", { method: "POST", body: JSON.stringify({ name }) }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["admin-sites"] });
      setNewName("");
      setLocation(`/admin/site/${data.site.id}`);
    },
  });

  const deleteSite = useMutation({
    mutationFn: (id: string) => api(`/admin/sites/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-sites"] });
      queryClient.invalidateQueries({ queryKey: ["public-sites"] });
      setDeleting(null);
    },
  });

  const logout = async () => {
    await api("/admin/logout", { method: "POST" });
    queryClient.invalidateQueries({ queryKey: ["admin-me"] });
  };

  if (me.isLoading) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-background">
        <p className="text-muted-foreground animate-pulse">Loading...</p>
      </div>
    );
  }

  if (!me.data?.authenticated) {
    return <LoginScreen onSuccess={() => queryClient.invalidateQueries({ queryKey: ["admin-me"] })} />;
  }

  return (
    <div className="min-h-[100dvh] bg-background text-foreground safe-area-pt safe-area-pb">
      <div className="max-w-2xl mx-auto p-6">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight">Sites</h1>
            <p className="text-muted-foreground">Create sites and draw their maps.</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="icon" className="rounded-full" onClick={() => setLocation("/admin/qr")} title="QR posters" data-testid="button-qr-posters">
              <QrCode className="w-5 h-5" />
            </Button>
            <Button variant="outline" size="icon" className="rounded-full" onClick={logout} title="Sign out" data-testid="button-admin-logout">
              <LogOut className="w-5 h-5" />
            </Button>
          </div>
        </div>

        <div className="flex gap-3 mb-8">
          <Input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && newName.trim() && createSite.mutate(newName.trim())}
            placeholder="New site name (e.g. Head Office)"
            className="h-13 rounded-2xl text-base h-12"
            data-testid="input-new-site-name"
          />
          <Button
            className="h-12 px-5 rounded-2xl"
            onClick={() => createSite.mutate(newName.trim())}
            disabled={!newName.trim() || createSite.isPending}
            data-testid="button-create-site"
          >
            <Plus className="w-5 h-5 mr-1" /> Create
          </Button>
        </div>
        {createSite.isError && (
          <p className="text-sm text-destructive mb-4">{(createSite.error as Error).message}</p>
        )}

        <div className="space-y-3">
          {(sites.data?.sites ?? []).map((site) => {
            const nav = siteIsNavigable(site);
            return (
              <div
                key={site.id}
                className="bg-card border border-card-border p-5 rounded-3xl shadow-sm flex items-center justify-between gap-3"
                data-testid={`card-site-${site.id}`}
              >
                <button
                  className="flex items-center gap-4 flex-1 text-left min-w-0"
                  onClick={() => setLocation(`/admin/site/${site.id}`)}
                >
                  <div className="w-11 h-11 rounded-2xl bg-secondary flex items-center justify-center shrink-0">
                    <MapIcon className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="font-bold text-lg truncate">{site.name}</div>
                    <div className="text-sm text-muted-foreground flex items-center gap-2">
                      <span className="font-mono">{site.id}</span>
                      {site.published ? (
                        <Badge className="bg-green-600 hover:bg-green-600">Published</Badge>
                      ) : (
                        <Badge variant="secondary">Draft</Badge>
                      )}
                      {!nav.ok && <Badge variant="outline">Setup incomplete</Badge>}
                    </div>
                  </div>
                </button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="rounded-full text-muted-foreground shrink-0"
                  onClick={() => setLocation(`/admin/qr?site=${site.id}`)}
                  title="Print QR posters"
                  data-testid={`button-qr-${site.id}`}
                >
                  <QrCode className="w-5 h-5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="rounded-full text-muted-foreground hover:text-destructive shrink-0"
                  onClick={() => setDeleting(site)}
                  data-testid={`button-delete-${site.id}`}
                >
                  <Trash2 className="w-5 h-5" />
                </Button>
                <ChevronRight className="w-5 h-5 text-muted-foreground shrink-0" />
              </div>
            );
          })}

          {sites.data && sites.data.sites.length === 0 && (
            <div className="text-center py-16 text-muted-foreground">
              No sites yet. Create your first one above.
              <p className="text-sm mt-2">
                (The built-in Broadcast Studios demo site is managed in code and always available.)
              </p>
            </div>
          )}
        </div>
      </div>

      <AlertDialog open={!!deleting} onOpenChange={(open) => !open && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete "{deleting?.name}"?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes the site, its map and its QR codes. Printed posters for this
              site will stop working.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleting && deleteSite.mutate(deleting.id)}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
