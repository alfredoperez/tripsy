"use client";

// A pick-one slot: "Asado lunch" with two to four options, each with its
// photo, why it's on the list and what it costs. Picking one puts it on top
// and folds the rest under "other options"; Change goes back to choosing.

import { useState } from "react";
import { stopMapUrl } from "@/lib/links";
import { photoUrl } from "@/lib/photos";
import type { Stop } from "@/lib/types";
import { GoogleMapsIcon, KindIcon } from "./icons";
import { Photo } from "./Photo";
import type { StopEditApi } from "./StopEdits";

export function ChoiceSlot({
  slot,
  options,
  api,
  changed,
}: {
  slot: Stop;
  options: Stop[];
  api: StopEditApi;
  changed: Set<string>;
}) {
  const [showOthers, setShowOthers] = useState(false);
  const sorted = [...options].sort((a, b) => a.position - b.position);
  const chosen = sorted.find((option) => option.id === slot.chosen_option_id) ?? null;
  const others = chosen ? sorted.filter((option) => option.id !== chosen.id) : sorted;
  const listId = `choice-${slot.id}`;

  return (
    <li className={`px-3 py-2 ${changed.has(slot.id) ? "just-changed" : ""}`}>
      <div className="rounded-[22px] bg-paper p-3">
        <div className="flex items-center gap-2 px-1">
          {slot.time_label && (
            <span className="font-mono text-[11px] uppercase text-muted">{slot.time_label}</span>
          )}
          <span
            className={`rounded-full px-2 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-wider ${
              chosen ? "bg-ink text-white" : "bg-accent text-ink"
            }`}
          >
            {chosen ? "Picked" : `Pick one · ${sorted.length}`}
          </span>
        </div>
        <h3 className="mt-1 px-1 text-[16px] font-semibold leading-snug [overflow-wrap:anywhere]">{slot.title}</h3>
        {slot.note && <p className="mt-0.5 px-1 text-[13px] leading-snug text-muted">{slot.note}</p>}

        <ul id={listId} className="mt-2.5 space-y-2">
          {chosen && (
            <OptionRow
              option={chosen}
              picked
              flash={changed.has(chosen.id)}
              onAction={() => api.choose(slot, null)}
            />
          )}
          {(!chosen || showOthers) &&
            others.map((option) => (
              <OptionRow
                key={option.id}
                option={option}
                flash={changed.has(option.id)}
                onAction={() => api.choose(slot, option.id)}
              />
            ))}
        </ul>

        {chosen && others.length > 0 && (
          <button
            type="button"
            aria-expanded={showOthers}
            aria-controls={listId}
            onClick={() => setShowOthers((value) => !value)}
            className="mt-2 w-full rounded-full bg-panel px-4 py-2.5 text-[13px] font-medium text-muted focus-visible:outline-2 focus-visible:outline-ink"
          >
            {showOthers
              ? "Hide the other options"
              : `${others.length} other option${others.length === 1 ? "" : "s"}`}
          </button>
        )}
      </div>
    </li>
  );
}

function OptionRow({
  option,
  picked = false,
  flash = false,
  onAction,
}: {
  option: Stop;
  picked?: boolean;
  flash?: boolean;
  onAction: () => void;
}) {
  const pill =
    "flex h-9 items-center justify-center gap-1.5 rounded-full px-3.5 text-[12px] font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink active:scale-[0.97] motion-reduce:active:scale-100";

  return (
    <li
      className={`grid grid-cols-[72px_1fr] gap-3 rounded-[18px] p-2 ${
        picked ? "bg-accent/30 ring-2 ring-ink" : "bg-panel"
      } ${flash ? "just-changed" : ""}`}
    >
      <Photo url={photoUrl(option)} kind={option.kind} className="h-[72px] w-[72px] rounded-[14px]">
        <span className="absolute bottom-1 left-1 flex h-6 w-6 items-center justify-center rounded-full bg-panel text-ink">
          <KindIcon kind={option.kind} className="h-3.5 w-3.5" />
        </span>
      </Photo>
      <div className="min-w-0">
        {option.time_label && (
          <span className="font-mono text-[11px] uppercase text-muted">{option.time_label}</span>
        )}
        <p className="text-[15px] font-semibold leading-snug [overflow-wrap:anywhere]">{option.title}</p>
        {option.note && <p className="mt-0.5 text-[13px] leading-snug text-muted">{option.note}</p>}
        <div className="mt-2 flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={onAction}
            aria-pressed={picked}
            className={`${pill} ${picked ? "bg-background text-ink" : "bg-ink text-white"}`}
          >
            {picked ? "Change" : "Pick this"}
          </button>
          <a
            href={stopMapUrl(option)}
            target="_blank"
            rel="noreferrer"
            className={`${pill} bg-background text-ink`}
          >
            <GoogleMapsIcon className="h-3.5 w-3.5" />
            Map
          </a>
        </div>
      </div>
    </li>
  );
}
