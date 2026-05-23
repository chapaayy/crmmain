"use client";

import { useEffect } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import { translationMapFor } from "@/lib/i18n";

const translatedAttributes = ["aria-label", "placeholder", "title"];
const skippedTags = new Set(["SCRIPT", "STYLE", "TEXTAREA", "CODE", "PRE"]);

export function TextLocalizer() {
  const { locale } = useAuth();

  useEffect(() => {
    const translatePage = () => translateElement(document.body, translationMapFor(locale));

    translatePage();
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === "characterData" && mutation.target.parentElement) {
          translateTextNode(mutation.target, translationMapFor(locale));
        }

        if (mutation.type === "attributes" && mutation.target instanceof HTMLElement) {
          translateAttributes(mutation.target, translationMapFor(locale));
        }

        mutation.addedNodes.forEach((node) => {
          if (node instanceof HTMLElement) {
            translateElement(node, translationMapFor(locale));
          } else if (node.nodeType === Node.TEXT_NODE) {
            translateTextNode(node, translationMapFor(locale));
          }
        });
      }
    });

    observer.observe(document.body, {
      attributes: true,
      attributeFilter: translatedAttributes,
      childList: true,
      characterData: true,
      subtree: true
    });

    return () => observer.disconnect();
  }, [locale]);

  return null;
}

function translateElement(root: HTMLElement, dictionary: Record<string, string>) {
  translateAttributes(root, dictionary);

  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const parent = node.parentElement;

      if (!parent || skippedTags.has(parent.tagName)) {
        return NodeFilter.FILTER_REJECT;
      }

      return node.textContent?.trim() ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
    }
  });
  const nodes: Node[] = [];

  while (walker.nextNode()) {
    nodes.push(walker.currentNode);
  }

  nodes.forEach((node) => translateTextNode(node, dictionary));
  root.querySelectorAll<HTMLElement>("*").forEach((element) => translateAttributes(element, dictionary));
}

function translateTextNode(node: Node, dictionary: Record<string, string>) {
  const current = node.textContent ?? "";
  const next = translateValue(current, dictionary);

  if (next !== current) {
    node.textContent = next;
  }
}

function translateAttributes(element: HTMLElement, dictionary: Record<string, string>) {
  for (const attribute of translatedAttributes) {
    const current = element.getAttribute(attribute);

    if (!current) {
      continue;
    }

    const next = translateValue(current, dictionary);

    if (next !== current) {
      element.setAttribute(attribute, next);
    }
  }
}

function translateValue(value: string, dictionary: Record<string, string>) {
  const prefix = value.match(/^\s*/)?.[0] ?? "";
  const suffix = value.match(/\s*$/)?.[0] ?? "";
  const trimmed = value.trim();
  const translated = dictionary[trimmed];

  return translated ? `${prefix}${translated}${suffix}` : value;
}
