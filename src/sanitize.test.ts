import { describe, it, expect } from "vitest";
import { toAscii, sanitizeDeep } from "./sanitize.js";

describe("toAscii", () => {
  it("leaves plain ASCII unchanged", () => {
    expect(toAscii("Roof - North side")).toBe("Roof - North side");
  });

  it("transliterates em-dash to a hyphen", () => {
    expect(toAscii("Roof — North side")).toBe("Roof - North side");
  });

  it("transliterates en-dash and other dashes to a hyphen", () => {
    expect(toAscii("a – b ‒ c ― d")).toBe("a - b - c - d");
  });

  it("transliterates smart single quotes and primes to a straight apostrophe", () => {
    expect(toAscii("‘O’Brien’s 6′")).toBe("'O'Brien's 6'");
  });

  it("transliterates smart double quotes to a straight quote", () => {
    expect(toAscii("“roof” 6″")).toBe('"roof" 6"');
  });

  it("expands an ellipsis to three dots", () => {
    expect(toAscii("done…")).toBe("done...");
  });

  it("deburrs accented Latin letters to their base form", () => {
    expect(toAscii("Pricé … döne")).toBe("Price ... done");
  });

  it("converts a non-breaking space to a regular space", () => {
    expect(toAscii("a b")).toBe("a b");
  });

  it("strips characters with no ASCII equivalent (emoji, CJK)", () => {
    expect(toAscii("Hi 👋 there")).toBe("Hi there");
    expect(toAscii("文档.pdf")).toBe(".pdf");
  });

  it("collapses the double space left behind when a char is stripped", () => {
    expect(toAscii("Roof 😀 North")).toBe("Roof North");
  });

  it("trims leading and trailing whitespace", () => {
    expect(toAscii("  hello  ")).toBe("hello");
  });

  it("returns an empty string when every character is stripped", () => {
    expect(toAscii("文档")).toBe("");
  });
});

describe("sanitizeDeep", () => {
  it("sanitizes a top-level string", () => {
    expect(sanitizeDeep("Roof — North")).toBe("Roof - North");
  });

  it("sanitizes string values nested in objects and arrays", () => {
    const input = {
      name: "José",
      notes: ["line — one", "line … two"],
      meta: { label: "“test”" },
    };
    expect(sanitizeDeep(input)).toEqual({
      name: "Jose",
      notes: ["line - one", "line ... two"],
      meta: { label: '"test"' },
    });
  });

  it("preserves non-string values and structure", () => {
    const input = { count: 3, active: true, missing: null, ratio: 1.5 };
    expect(sanitizeDeep(input)).toEqual(input);
  });

  it("leaves object keys untouched", () => {
    const input = { "föo": "bär" };
    expect(sanitizeDeep(input)).toEqual({ "föo": "bar" });
  });
});
