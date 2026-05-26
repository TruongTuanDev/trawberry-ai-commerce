"use client";

/* eslint-disable @next/next/no-img-element */

import { useEffect, useState } from "react";
import { toast } from "@/components/ui/use-toast";
import {
  listHomepageSlides,
  createHomepageSlide,
  updateHomepageSlide,
  deleteHomepageSlide,
  toggleHomepageSlide,
  reorderHomepageSlides,
  uploadHomepageSlideImage,
  type AdminHomepageSlide,
} from "@/lib/admin-api";

function toInputDateTime(isoString: string | null | undefined): string {
  if (!isoString) return "";
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return "";
  const tzOffset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - tzOffset).toISOString().slice(0, 16);
}

function toISODateTime(inputString: string | null | undefined): string | null {
  if (!inputString) return null;
  const date = new Date(inputString);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

function formatPublishWindow(startsAt: string | null, endsAt: string | null) {
  if (!startsAt && !endsAt) return "Always active";
  const startStr = startsAt ? new Date(startsAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "Any time";
  const endStr = endsAt ? new Date(endsAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "Any time";
  return `${startStr} - ${endStr}`;
}

export function AdminHomepageSlidesPageClient() {
  const [slides, setSlides] = useState<AdminHomepageSlide[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Form/Modal states
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingSlide, setEditingSlide] = useState<AdminHomepageSlide | null>(null);
  
  // Preview Slide Modal
  const [previewSlide, setPreviewSlide] = useState<AdminHomepageSlide | null>(null);
  const [previewMode, setPreviewMode] = useState<"desktop" | "mobile">("desktop");

  // Form Fields
  const [titleRu, setTitleRu] = useState("");
  const [titleEn, setTitleEn] = useState("");
  const [subtitleRu, setSubtitleRu] = useState("");
  const [subtitleEn, setSubtitleEn] = useState("");
  const [ctaLabelRu, setCtaLabelRu] = useState("");
  const [ctaLabelEn, setCtaLabelEn] = useState("");
  const [ctaUrl, setCtaUrl] = useState("");
  const [altTextRu, setAltTextRu] = useState("");
  const [altTextEn, setAltTextEn] = useState("");
  const [imageDesktopUrl, setImageDesktopUrl] = useState("");
  const [imageDesktopStorageKey, setImageDesktopStorageKey] = useState("");
  const [imageMobileUrl, setImageMobileUrl] = useState("");
  const [imageMobileStorageKey, setImageMobileStorageKey] = useState("");
  const [backgroundColor, setBackgroundColor] = useState("");
  const [displayOrder, setDisplayOrder] = useState(0);
  const [isActive, setIsActive] = useState(false);
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");

  const [uploadingDesktop, setUploadingDesktop] = useState(false);
  const [uploadingMobile, setUploadingMobile] = useState(false);
  const [saving, setSaving] = useState(false);

  const fetchSlides = async () => {
    setLoading(true);
    try {
      const data = await listHomepageSlides();
      setSlides(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load slides");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const init = async () => {
      await fetchSlides();
    };
    void init();
  }, []);

  const openAddForm = () => {
    setEditingSlide(null);
    setTitleRu("");
    setTitleEn("");
    setSubtitleRu("");
    setSubtitleEn("");
    setCtaLabelRu("");
    setCtaLabelEn("");
    setCtaUrl("");
    setAltTextRu("");
    setAltTextEn("");
    setImageDesktopUrl("");
    setImageDesktopStorageKey("");
    setImageMobileUrl("");
    setImageMobileStorageKey("");
    setBackgroundColor("");
    setDisplayOrder(slides.length > 0 ? Math.max(...slides.map((s) => s.displayOrder)) + 1 : 0);
    setIsActive(false);
    setStartsAt("");
    setEndsAt("");
    setIsFormOpen(true);
  };

  const openEditForm = (slide: AdminHomepageSlide) => {
    setEditingSlide(slide);
    setTitleRu(slide.titleRu || "");
    setTitleEn(slide.titleEn || "");
    setSubtitleRu(slide.subtitleRu || "");
    setSubtitleEn(slide.subtitleEn || "");
    setCtaLabelRu(slide.ctaLabelRu || "");
    setCtaLabelEn(slide.ctaLabelEn || "");
    setCtaUrl(slide.ctaUrl || "");
    setAltTextRu(slide.altTextRu || "");
    setAltTextEn(slide.altTextEn || "");
    setImageDesktopUrl(slide.imageDesktopUrl);
    setImageDesktopStorageKey(slide.imageDesktopStorageKey || "");
    setImageMobileUrl(slide.imageMobileUrl || "");
    setImageMobileStorageKey(slide.imageMobileStorageKey || "");
    setBackgroundColor(slide.backgroundColor || "");
    setDisplayOrder(slide.displayOrder);
    setIsActive(slide.isActive);
    setStartsAt(toInputDateTime(slide.startsAt));
    setEndsAt(toInputDateTime(slide.endsAt));
    setIsFormOpen(true);
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>, target: "desktop" | "mobile") => {
    const file = event.target.files?.[0];
    if (!file) return;

    // MIME type validation
    if (!["image/jpeg", "image/jpg", "image/png", "image/webp"].includes(file.type)) {
      toast.error("Invalid file type. Only JPG, PNG, and WEBP are allowed.");
      return;
    }

    // Size limit (5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error("File is too large. Max size is 5MB.");
      return;
    }

    if (target === "desktop") {
      setUploadingDesktop(true);
    } else {
      setUploadingMobile(true);
    }

    try {
      const response = await uploadHomepageSlideImage(file);
      if (target === "desktop") {
        setImageDesktopUrl(response.url);
        setImageDesktopStorageKey(response.storageKey);
        toast.success("Desktop image uploaded successfully.");
      } else {
        setImageMobileUrl(response.url);
        setImageMobileStorageKey(response.storageKey);
        toast.success("Mobile image uploaded successfully.");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to upload image");
    } finally {
      if (target === "desktop") {
        setUploadingDesktop(false);
      } else {
        setUploadingMobile(false);
      }
    }
  };

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!imageDesktopUrl) {
      toast.error("Desktop image URL or upload is required.");
      return;
    }

    const startISO = toISODateTime(startsAt);
    const endISO = toISODateTime(endsAt);

    if (startISO && endISO && new Date(startISO) >= new Date(endISO)) {
      toast.error("Publish window start time must be before end time.");
      return;
    }

    setSaving(true);
    const input = {
      titleRu: titleRu || null,
      titleEn: titleEn || null,
      subtitleRu: subtitleRu || null,
      subtitleEn: subtitleEn || null,
      ctaLabelRu: ctaLabelRu || null,
      ctaLabelEn: ctaLabelEn || null,
      ctaUrl: ctaUrl || null,
      altTextRu: altTextRu || null,
      altTextEn: altTextEn || null,
      imageDesktopUrl,
      imageDesktopStorageKey: imageDesktopStorageKey || null,
      imageMobileUrl: imageMobileUrl || null,
      imageMobileStorageKey: imageMobileStorageKey || null,
      backgroundColor: backgroundColor || null,
      displayOrder,
      isActive,
      startsAt: startISO,
      endsAt: endISO,
    };

    try {
      if (editingSlide) {
        await updateHomepageSlide(editingSlide.id, input);
        toast.success("Slide updated successfully.");
      } else {
        await createHomepageSlide(input);
        toast.success("Slide created successfully.");
      }
      setIsFormOpen(false);
      void fetchSlides();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save slide");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Are you sure you want to delete this slide?")) return;
    try {
      await deleteHomepageSlide(id);
      toast.success("Slide deleted successfully.");
      void fetchSlides();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete slide");
    }
  };

  const handleToggleActive = async (id: string) => {
    try {
      await toggleHomepageSlide(id);
      toast.success("Toggle active status success.");
      void fetchSlides();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to toggle status");
    }
  };

  const handleMove = async (index: number, direction: "up" | "down") => {
    const newSlides = [...slides];
    const swapIndex = direction === "up" ? index - 1 : index + 1;
    if (swapIndex < 0 || swapIndex >= slides.length) return;

    // Swap displays positions
    const temp = newSlides[index];
    newSlides[index] = newSlides[swapIndex];
    newSlides[swapIndex] = temp;

    // Call reorder backend API
    try {
      await reorderHomepageSlides(newSlides.map((s) => s.id));
      toast.success("Reordered slides success.");
      void fetchSlides();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to reorder slides");
    }
  };

  return (
    <div className="space-y-6" data-testid="admin-homepage-slides-page">
      {/* Header section */}
      <section className="rounded-[1.5rem] border border-[var(--border)] bg-white px-5 py-5 flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--muted)]">
            Homepage banner management
          </p>
          <h2 className="mt-3 font-[family-name:var(--font-mono-app)] text-3xl font-bold text-[var(--foreground)]">
            Homepage slides
          </h2>
          <p className="mt-2 text-sm text-[var(--muted)]">
            Manage public homepage banner images
          </p>
        </div>
        <button
          onClick={openAddForm}
          className="rounded-2xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white shadow-md hover:bg-indigo-700 transition cursor-pointer"
          data-testid="add-slide-btn"
        >
          Add slide
        </button>
      </section>

      {/* Main content list */}
      {error && (
        <div className="rounded-[1rem] bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>
      )}

      {loading ? (
        <section className="rounded-[1.5rem] border border-[var(--border)] bg-white p-6 text-sm text-[var(--muted)]">
          Loading slides...
        </section>
      ) : slides.length === 0 ? (
        <section className="rounded-[1.5rem] border border-[var(--border)] bg-white p-6 text-sm text-center text-[var(--muted)]">
          {"No homepage slides found. Create your first slide by clicking \"Add slide\" above."}
        </section>
      ) : (
        <section className="rounded-[1.5rem] border border-[var(--border)] bg-white overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse" data-testid="slides-table">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/70 text-xs font-semibold uppercase tracking-wider text-slate-500">
                  <th className="px-6 py-4">Preview</th>
                  <th className="px-6 py-4">Title (EN/RU)</th>
                  <th className="px-6 py-4">Display Order</th>
                  <th className="px-6 py-4">Publish Window</th>
                  <th className="px-6 py-4">Active</th>
                  <th className="px-6 py-4">Updated At</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {slides.map((slide, index) => (
                  <tr key={slide.id} className="hover:bg-slate-50/50 transition-colors" data-testid="slide-row">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="relative h-12 w-28 rounded-lg overflow-hidden border border-slate-200 bg-slate-100">
                        <img
                          src={slide.imageDesktopUrl}
                          alt={slide.altTextEn || "Desktop slide"}
                          className="h-full w-full object-cover"
                        />
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-semibold text-slate-800">
                        {slide.titleEn || <span className="text-slate-400 italic">No English Title</span>}
                      </div>
                      <div className="text-xs text-slate-400 mt-0.5">
                        {slide.titleRu || <span className="italic">No Russian Title</span>}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-slate-600 font-medium">
                      {slide.displayOrder}
                    </td>
                    <td className="px-6 py-4 text-xs text-slate-500">
                      {formatPublishWindow(slide.startsAt, slide.endsAt)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <button
                        onClick={() => void handleToggleActive(slide.id)}
                        className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold transition cursor-pointer ${
                          slide.isActive
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                            : "bg-slate-50 text-slate-500 border border-slate-200"
                        }`}
                        data-testid={`slide-toggle-active-${index}`}
                      >
                        {slide.isActive ? "Active" : "Inactive"}
                      </button>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-xs text-slate-400">
                      {new Date(slide.updatedAt).toLocaleString("en-US")}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right space-x-2">
                      <button
                        onClick={() => setPreviewSlide(slide)}
                        className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 transition cursor-pointer"
                        data-testid={`slide-preview-${index}`}
                      >
                        Preview
                      </button>
                      <button
                        onClick={() => openEditForm(slide)}
                        className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-indigo-600 hover:bg-indigo-50 hover:border-indigo-200 transition cursor-pointer"
                        data-testid={`slide-edit-${index}`}
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => void handleDelete(slide.id)}
                        className="rounded-lg border border-rose-200 bg-white px-2.5 py-1.5 text-xs font-medium text-rose-600 hover:bg-rose-50 transition cursor-pointer"
                        data-testid={`slide-delete-${index}`}
                      >
                        Delete
                      </button>
                      <button
                        onClick={() => void handleMove(index, "up")}
                        disabled={index === 0}
                        className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:hover:bg-white transition cursor-pointer"
                        data-testid={`slide-move-up-${index}`}
                      >
                        &uarr;
                      </button>
                      <button
                        onClick={() => void handleMove(index, "down")}
                        disabled={index === slides.length - 1}
                        className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:hover:bg-white transition cursor-pointer"
                        data-testid={`slide-move-down-${index}`}
                      >
                        &darr;
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Slide Add/Edit Modal (Overlay Drawer style) */}
      {isFormOpen && (
        <div className="fixed inset-0 z-50 flex justify-end" data-testid="slide-form-modal">
          <div
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity"
            onClick={() => setIsFormOpen(false)}
          />
          <div className="relative w-full max-w-2xl bg-white h-full overflow-y-auto p-6 shadow-2xl flex flex-col z-10">
            <div className="flex items-center justify-between border-b border-slate-200 pb-4 mb-6">
              <h3 className="text-xl font-bold text-slate-800">
                {editingSlide ? "Edit Homepage Slide" : "Add Homepage Slide"}
              </h3>
              <button
                onClick={() => setIsFormOpen(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 cursor-pointer"
                aria-label="Close form"
              >
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={(e) => void handleSave(e)} className="space-y-6 flex-1">
              {/* Image Upload Area */}
              <div className="bg-slate-50 rounded-2xl p-5 border border-slate-200/60 space-y-4">
                <h4 className="text-sm font-semibold text-slate-700">Banner Images Upload</h4>
                <p className="text-xs text-slate-500">
                  Recommended sizes: Desktop: 1600&times;600 or 1800&times;700. Mobile: 900&times;1200 or 1080&times;1350. Max size 5MB (JPG, PNG, WEBP). SVG and Video are not allowed.
                </p>

                {/* Desktop Upload */}
                <div className="grid gap-3 sm:grid-cols-[1.5fr_1fr]">
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1">
                      Desktop Image URL *
                    </label>
                    <input
                      type="text"
                      value={imageDesktopUrl}
                      onChange={(e) => setImageDesktopUrl(e.target.value)}
                      placeholder="https://example.com/desktop.jpg"
                      className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm"
                      data-testid="input-desktop-url"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1">
                      Or Upload File
                    </label>
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      onChange={(e) => void handleFileUpload(e, "desktop")}
                      className="hidden"
                      id="desktop-file-upload"
                    />
                    <label
                      htmlFor="desktop-file-upload"
                      className="inline-flex w-full items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer transition"
                    >
                      {uploadingDesktop ? "Uploading..." : "Choose File"}
                    </label>
                  </div>
                </div>

                {/* Mobile Upload */}
                <div className="grid gap-3 sm:grid-cols-[1.5fr_1fr]">
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1">
                      Mobile Image URL (Optional)
                    </label>
                    <input
                      type="text"
                      value={imageMobileUrl}
                      onChange={(e) => setImageMobileUrl(e.target.value)}
                      placeholder="https://example.com/mobile.jpg"
                      className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm"
                      data-testid="input-mobile-url"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1">
                      Or Upload File
                    </label>
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      onChange={(e) => void handleFileUpload(e, "mobile")}
                      className="hidden"
                      id="mobile-file-upload"
                    />
                    <label
                      htmlFor="mobile-file-upload"
                      className="inline-flex w-full items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer transition"
                    >
                      {uploadingMobile ? "Uploading..." : "Choose File"}
                    </label>
                  </div>
                </div>
              </div>

              {/* Title & Subtitle RU/EN */}
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1">
                    Title (EN)
                  </label>
                  <input
                    type="text"
                    value={titleEn}
                    onChange={(e) => setTitleEn(e.target.value)}
                    placeholder="Summer Dress Sale"
                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm"
                    data-testid="input-title-en"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1">
                    Title (RU)
                  </label>
                  <input
                    type="text"
                    value={titleRu}
                    onChange={(e) => setTitleRu(e.target.value)}
                    placeholder="Распродажа летних платьев"
                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm"
                    data-testid="input-title-ru"
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1">
                    Subtitle (EN)
                  </label>
                  <input
                    type="text"
                    value={subtitleEn}
                    onChange={(e) => setSubtitleEn(e.target.value)}
                    placeholder="Up to 50% off select brands"
                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm"
                    data-testid="input-subtitle-en"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1">
                    Subtitle (RU)
                  </label>
                  <input
                    type="text"
                    value={subtitleRu}
                    onChange={(e) => setSubtitleRu(e.target.value)}
                    placeholder="Скидки до 50% на выбранные бренды"
                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm"
                    data-testid="input-subtitle-ru"
                  />
                </div>
              </div>

              {/* CTA and Alt texts */}
              <div className="grid gap-4 sm:grid-cols-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1">
                    CTA Label (EN)
                  </label>
                  <input
                    type="text"
                    value={ctaLabelEn}
                    onChange={(e) => setCtaLabelEn(e.target.value)}
                    placeholder="Shop Now"
                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm"
                    data-testid="input-cta-label-en"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1">
                    CTA Label (RU)
                  </label>
                  <input
                    type="text"
                    value={ctaLabelRu}
                    onChange={(e) => setCtaLabelRu(e.target.value)}
                    placeholder="Купить"
                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm"
                    data-testid="input-cta-label-ru"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1">
                    CTA Destination URL
                  </label>
                  <input
                    type="text"
                    value={ctaUrl}
                    onChange={(e) => setCtaUrl(e.target.value)}
                    placeholder="/products?category=dresses"
                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm"
                    data-testid="input-cta-url"
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1">
                    Alt Text (EN)
                  </label>
                  <input
                    type="text"
                    value={altTextEn}
                    onChange={(e) => setAltTextEn(e.target.value)}
                    placeholder="English banner alt description"
                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm"
                    data-testid="input-alt-en"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1">
                    Alt Text (RU)
                  </label>
                  <input
                    type="text"
                    value={altTextRu}
                    onChange={(e) => setAltTextRu(e.target.value)}
                    placeholder="Описание баннера на русском"
                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm"
                    data-testid="input-alt-ru"
                  />
                </div>
              </div>

              {/* Background Color, Display Order, Active checkbox */}
              <div className="grid gap-4 sm:grid-cols-3 items-center">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1">
                    Background Color
                  </label>
                  <input
                    type="text"
                    value={backgroundColor}
                    onChange={(e) => setBackgroundColor(e.target.value)}
                    placeholder="#ffffff or linear-gradient(...)"
                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm"
                    data-testid="input-bg-color"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1">
                    Display Order
                  </label>
                  <input
                    type="number"
                    value={displayOrder}
                    onChange={(e) => setDisplayOrder(parseInt(e.target.value) || 0)}
                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm"
                    data-testid="input-display-order"
                  />
                </div>
                <div className="flex items-center pt-5">
                  <input
                    type="checkbox"
                    id="isActive"
                    checked={isActive}
                    onChange={(e) => setIsActive(e.target.checked)}
                    className="h-5 w-5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                    data-testid="input-is-active"
                  />
                  <label htmlFor="isActive" className="ml-2 text-sm font-semibold text-slate-700 cursor-pointer">
                    Is Active
                  </label>
                </div>
              </div>

              {/* Publish Window: startsAt & endsAt */}
              <div className="grid gap-4 sm:grid-cols-2 bg-slate-50/50 p-4 rounded-xl border border-slate-100">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1">
                    Starts At (Local Time)
                  </label>
                  <input
                    type="datetime-local"
                    value={startsAt}
                    onChange={(e) => setStartsAt(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm"
                    data-testid="input-starts-at"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1">
                    Ends At (Local Time)
                  </label>
                  <input
                    type="datetime-local"
                    value={endsAt}
                    onChange={(e) => setEndsAt(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm"
                    data-testid="input-ends-at"
                  />
                </div>
              </div>

              {/* Submit Buttons */}
              <div className="border-t border-slate-100 pt-6 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  className="rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving || uploadingDesktop || uploadingMobile}
                  className="rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-md hover:bg-indigo-700 disabled:opacity-50 cursor-pointer transition"
                  data-testid="save-slide-btn"
                >
                  {saving ? "Saving..." : "Save Slide"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Visual Live Preview Modal */}
      {previewSlide && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6" data-testid="slide-preview-modal">
          <div
            className="fixed inset-0 bg-slate-900/65 backdrop-blur-sm transition-opacity"
            onClick={() => setPreviewSlide(null)}
          />
          <div className="relative w-full max-w-4xl bg-slate-900 rounded-[2rem] overflow-hidden shadow-2xl flex flex-col z-10 border border-slate-700">
            {/* Header / Selector */}
            <div className="flex items-center justify-between bg-slate-800 px-6 py-4 border-b border-slate-700">
              <div className="flex items-center gap-4">
                <h3 className="text-lg font-bold text-white">Slide Visual Preview</h3>
                <div className="flex bg-slate-950 rounded-lg p-0.5 border border-slate-700 text-xs">
                  <button
                    onClick={() => setPreviewMode("desktop")}
                    className={`px-3 py-1.5 rounded-md font-semibold transition ${
                      previewMode === "desktop" ? "bg-indigo-600 text-white" : "text-slate-400 hover:text-white"
                    }`}
                  >
                    Desktop Look
                  </button>
                  <button
                    onClick={() => setPreviewMode("mobile")}
                    className={`px-3 py-1.5 rounded-md font-semibold transition ${
                      previewMode === "mobile" ? "bg-indigo-600 text-white" : "text-slate-400 hover:text-white"
                    }`}
                  >
                    Mobile Look
                  </button>
                </div>
              </div>
              <button
                onClick={() => setPreviewSlide(null)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-700 hover:text-white cursor-pointer"
                aria-label="Close preview"
              >
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Simulated Live viewport */}
            <div className="p-6 bg-slate-950 flex justify-center items-center overflow-auto min-h-[360px]">
              <div
                className={`relative overflow-hidden rounded-2xl shadow-xl transition-all duration-300 border border-slate-800 ${
                  previewMode === "desktop" ? "w-full aspect-[21/9] min-h-[250px]" : "w-[300px] aspect-[9/12]"
                }`}
                style={{ background: previewSlide.backgroundColor || "#0f172a" }}
              >
                {/* Visual Backdrop */}
                <div className="absolute inset-0 w-full h-full">
                  <img
                    src={
                      previewMode === "desktop"
                        ? previewSlide.imageDesktopUrl
                        : (previewSlide.imageMobileUrl || previewSlide.imageDesktopUrl)
                    }
                    alt="Preview"
                    className="w-full h-full object-fill"
                  />
                </div>

                {/* Overlay Text */}
                {(previewSlide.titleEn || previewSlide.titleRu || previewSlide.subtitleEn || previewSlide.subtitleRu || previewSlide.ctaLabelEn) && (
                  <div className="absolute inset-0 flex flex-col justify-end p-4 text-white pointer-events-none">
                    <div className="bg-black/50 backdrop-blur-md border border-white/10 rounded-2xl p-4 max-w-[85%] space-y-1 shadow-2xl pointer-events-auto">
                      {(previewSlide.titleEn || previewSlide.titleRu) && (
                        <h4 className="text-sm font-bold leading-tight drop-shadow-md">
                          {previewSlide.titleEn || previewSlide.titleRu}
                        </h4>
                      )}
                      {(previewSlide.subtitleEn || previewSlide.subtitleRu) && (
                        <p className="text-[10px] text-white/90 leading-relaxed drop-shadow">
                          {previewSlide.subtitleEn || previewSlide.subtitleRu}
                        </p>
                      )}
                      {previewSlide.ctaLabelEn && (
                        <div className="pt-1.5">
                          <span className="inline-block rounded-full bg-white text-slate-950 px-3 py-1 text-[10px] font-semibold shadow-sm">
                            {previewSlide.ctaLabelEn}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
