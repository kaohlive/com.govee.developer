# Homey CSS Style Guide

This skill documents the official Homey CSS Style Library for custom pairing screens and app settings pages.

## Overview

The Homey Style Library provides consistent styling that works on Homey Cloud and Homey Pro v8.1.0+. It automatically handles dark/light mode switching.

## Setup

Include the Homey script in your HTML:

```html
<head>
  <script type="text/javascript" src="/homey.js" data-origin="settings"></script>
</head>
```

## Header & Typography

```html
<header class="homey-header">
  <h1 class="homey-title">Page Title</h1>
  <p class="homey-subtitle">Description or instructions text</p>
</header>
```

| Class | Description |
|-------|-------------|
| `.homey-header` | Container with spacing and divider line |
| `.homey-title` | Main heading element |
| `.homey-subtitle` | Secondary text beneath title |

## Form Structure

```html
<form class="homey-form">
  <fieldset class="homey-form-fieldset">
    <legend class="homey-form-legend">Section Title</legend>

    <div class="homey-form-group">
      <label class="homey-form-label" for="input1">Label Text</label>
      <input class="homey-form-input" id="input1" type="text" />
    </div>

    <div class="homey-form-group">
      <label class="homey-form-label" for="select1">Dropdown</label>
      <select class="homey-form-select" id="select1">
        <option>Option 1</option>
        <option>Option 2</option>
      </select>
    </div>

    <div class="homey-form-group">
      <label class="homey-form-label" for="textarea1">Multi-line</label>
      <textarea class="homey-form-textarea" id="textarea1"></textarea>
    </div>
  </fieldset>
</form>
```

| Class | Description |
|-------|-------------|
| `.homey-form` | Primary form wrapper |
| `.homey-form-fieldset` | Grouped form sections |
| `.homey-form-legend` | Fieldset titles |
| `.homey-form-group` | Label + input pairing with vertical spacing |
| `.homey-form-label` | Form labels |
| `.homey-form-input` | Text, number, password, URL inputs |
| `.homey-form-select` | Dropdown selections |
| `.homey-form-textarea` | Multi-line text areas |

## Radio Buttons

```html
<div class="homey-form-radio-set">
  <div class="homey-form-radio-set-title">Choose an option</div>

  <label class="homey-form-radio">
    <input class="homey-form-radio-input" type="radio" name="option" value="1" />
    <span class="homey-form-radio-checkmark"></span>
    <span class="homey-form-radio-text">Option 1</span>
  </label>

  <label class="homey-form-radio">
    <input class="homey-form-radio-input" type="radio" name="option" value="2" />
    <span class="homey-form-radio-checkmark"></span>
    <span class="homey-form-radio-text">Option 2</span>
  </label>
</div>
```

## Checkboxes

```html
<div class="homey-form-checkbox-set">
  <div class="homey-form-checkbox-set-title">Select options</div>

  <label class="homey-form-checkbox">
    <input class="homey-form-checkbox-input" type="checkbox" />
    <span class="homey-form-checkbox-checkmark"></span>
    <span class="homey-form-checkbox-text">Enable feature</span>
  </label>
</div>
```

## Buttons

### Button Variants

```html
<!-- Primary (blue/accent) -->
<button class="homey-button-primary">Primary</button>

<!-- Secondary (gray/neutral) -->
<button class="homey-button-secondary">Secondary</button>

<!-- Danger (red) -->
<button class="homey-button-danger">Delete</button>

<!-- Transparent -->
<button class="homey-button-transparent">Cancel</button>
```

### Button Modifiers

```html
<!-- Full width -->
<button class="homey-button-primary-full">Full Width Button</button>

<!-- With shadow -->
<button class="homey-button-primary-shadow">Shadowed Button</button>

<!-- Small size -->
<button class="homey-button-secondary-small">Small Button</button>

<!-- Combined modifiers -->
<button class="homey-button-danger-full-shadow">Danger Full Shadow</button>
```

### Button States

```html
<!-- Loading state -->
<button class="homey-button-primary is-loading">Loading...</button>

<!-- Disabled state -->
<button class="homey-button-primary is-disabled">Disabled</button>
```

### Button Naming Pattern

Format: `.homey-button-{variant}[-modifier][-modifier]`

**Variants:** `primary`, `secondary`, `danger`, `transparent`

**Modifiers:** `full`, `shadow`, `small`

**Examples:**
- `.homey-button-primary`
- `.homey-button-primary-full`
- `.homey-button-secondary-small`
- `.homey-button-danger-shadow`
- `.homey-button-primary-full-shadow`

## CSS Variables (Color System)

Homey provides CSS variables that automatically adapt to light/dark mode. Use them with the `rgb(var(--variable))` syntax.

### Tint Scale (Neutral Colors)

The tint scale goes from 1 (lightest) to 12 (darkest) in light mode, and reverses in dark mode.

```css
/* Backgrounds */
.light-bg { background-color: rgb(var(--tint-1)); }
.card-bg { background-color: rgb(var(--tint-2)); }
.hover-bg { background-color: rgb(var(--tint-3)); }
.active-bg { background-color: rgb(var(--tint-4)); }

/* Borders */
.border { border: 1px solid rgb(var(--tint-4)); }
.border-subtle { border: 1px solid rgb(var(--tint-5)); }

/* Text */
.text-muted { color: rgb(var(--tint-7)); }
.text-secondary { color: rgb(var(--tint-9)); }
.text-primary { color: rgb(var(--tint-11)); }
.text-emphasis { color: rgb(var(--tint-12)); }
```

| Variable | Light Mode | Dark Mode | Use Case |
|----------|------------|-----------|----------|
| `--tint-1` | Near white | Near black | Page background |
| `--tint-2` | Very light | Very dark | Card backgrounds |
| `--tint-3` | Light | Dark | Hover states |
| `--tint-4` | Light gray | Dark gray | Borders, dividers |
| `--tint-5` - `--tint-6` | Mid-light | Mid-dark | Subtle borders |
| `--tint-7` - `--tint-8` | Mid gray | Mid gray | Muted text, icons |
| `--tint-9` - `--tint-10` | Dark gray | Light gray | Secondary text |
| `--tint-11` - `--tint-12` | Near black | Near white | Primary text |

### Primary Color (Accent)

```css
.accent { color: rgb(var(--primary-original)); }
.accent-bg { background-color: rgb(var(--primary-original)); }
.accent-text-on-accent { color: rgb(var(--primary-original-contrast)); }

/* Primary scale for subtle backgrounds */
.accent-subtle-bg { background-color: rgb(var(--primary-3)); }
.accent-border { border: 1px solid rgb(var(--primary-7)); }
.accent-text { color: rgb(var(--primary-11)); }
```

### Status Colors

Each status color has a full scale (1-12) plus `original` and `original-contrast`.

#### Success (Green)

```css
.success-dot { background-color: rgb(var(--success-original)); }
.success-bg { background-color: rgb(var(--success-3)); }
.success-border { border: 1px solid rgb(var(--success-7)); }
.success-text { color: rgb(var(--success-11)); }
.success-text-on-success { color: rgb(var(--success-original-contrast)); }
```

#### Danger (Red)

```css
.error-dot { background-color: rgb(var(--danger-original)); }
.error-bg { background-color: rgb(var(--danger-3)); }
.error-border { border: 1px solid rgb(var(--danger-7)); }
.error-text { color: rgb(var(--danger-11)); }
```

#### Warning (Orange/Yellow)

```css
.warning-dot { background-color: rgb(var(--warning-original)); }
.warning-bg { background-color: rgb(var(--warning-3)); }
.warning-border { border: 1px solid rgb(var(--warning-7)); }
.warning-text { color: rgb(var(--warning-11)); }
```

#### Info (Blue)

```css
.info-bg { background-color: rgb(var(--info-3)); }
.info-border { border: 1px solid rgb(var(--info-7)); }
.info-text { color: rgb(var(--info-11)); }
```

## Common UI Patterns

### Status Card

```html
<div class="status-card">
  <div class="status-row">
    <span class="status-label">Status</span>
    <span class="status-value">
      <span class="status-dot success"></span>
      Connected
    </span>
  </div>
</div>

<style>
  .status-card {
    background-color: rgb(var(--tint-2));
    border-radius: 12px;
    padding: 16px;
  }
  .status-row {
    display: flex;
    justify-content: space-between;
    padding: 10px 0;
    border-bottom: 1px solid rgb(var(--tint-4));
  }
  .status-row:last-child { border-bottom: none; }
  .status-label { color: rgb(var(--tint-9)); }
  .status-value { color: rgb(var(--tint-12)); font-weight: 500; }
  .status-dot {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    display: inline-block;
    margin-right: 8px;
  }
  .status-dot.success { background-color: rgb(var(--success-original)); }
  .status-dot.error { background-color: rgb(var(--danger-original)); }
  .status-dot.warning { background-color: rgb(var(--warning-original)); }
</style>
```

### Info Box

```html
<div class="info-box">
  Important information or instructions for the user.
</div>

<style>
  .info-box {
    background-color: rgb(var(--info-3));
    border-radius: 8px;
    padding: 12px;
    font-size: 13px;
    color: rgb(var(--info-11));
    margin-bottom: 16px;
  }
</style>
```

### Alert Messages

```html
<div class="error-message">Something went wrong!</div>
<div class="success-message">Operation completed successfully!</div>

<style>
  .error-message {
    background-color: rgb(var(--danger-3));
    border: 1px solid rgb(var(--danger-7));
    border-radius: 8px;
    padding: 12px;
    color: rgb(var(--danger-11));
  }
  .success-message {
    background-color: rgb(var(--success-3));
    border: 1px solid rgb(var(--success-7));
    border-radius: 8px;
    padding: 12px;
    color: rgb(var(--success-11));
  }
</style>
```

### Device/Item Card

```html
<div class="device-item">
  <div class="device-header">
    <span class="device-name">Device Name</span>
    <span class="device-status on">On</span>
  </div>
  <div class="device-details">
    <span class="device-detail-label">IP Address</span>
    <span class="device-detail-value">192.168.1.100</span>
  </div>
</div>

<style>
  .device-item {
    background-color: rgb(var(--tint-2));
    border-radius: 8px;
    padding: 12px;
    margin-bottom: 8px;
  }
  .device-header {
    display: flex;
    justify-content: space-between;
    margin-bottom: 8px;
  }
  .device-name {
    font-weight: 600;
    color: rgb(var(--tint-12));
  }
  .device-status {
    padding: 4px 10px;
    border-radius: 4px;
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
  }
  .device-status.on {
    background-color: rgb(var(--success-original));
    color: rgb(var(--success-original-contrast));
  }
  .device-status.off {
    background-color: rgb(var(--tint-6));
    color: rgb(var(--tint-12));
  }
  .device-detail-label {
    color: rgb(var(--tint-7));
    font-size: 10px;
    text-transform: uppercase;
  }
  .device-detail-value {
    color: rgb(var(--tint-11));
  }
</style>
```

### Tab Navigation

```html
<div class="tab-container">
  <button class="tab-button active" data-tab="tab1">Tab 1</button>
  <button class="tab-button" data-tab="tab2">Tab 2</button>
</div>

<div id="tab1" class="tab-content active">Tab 1 content</div>
<div id="tab2" class="tab-content">Tab 2 content</div>

<style>
  .tab-container {
    display: flex;
    margin-bottom: 20px;
    gap: 4px;
  }
  .tab-button {
    flex: 1;
    padding: 12px 8px;
    border: none;
    background-color: rgb(var(--tint-3));
    color: rgb(var(--tint-9));
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    border-radius: 8px 8px 0 0;
    border-bottom: 2px solid transparent;
  }
  .tab-button:hover {
    background-color: rgb(var(--tint-4));
  }
  .tab-button.active {
    background-color: rgb(var(--tint-2));
    color: rgb(var(--primary-original));
    border-bottom-color: rgb(var(--primary-original));
  }
  .tab-content { display: none; }
  .tab-content.active { display: block; }
</style>

<script>
  document.querySelectorAll('.tab-button').forEach(button => {
    button.addEventListener('click', () => {
      const tabId = button.getAttribute('data-tab');

      document.querySelectorAll('.tab-button').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));

      button.classList.add('active');
      document.getElementById(tabId).classList.add('active');
    });
  });
</script>
```

## Loading Spinner

```html
<span class="spinner"></span>

<style>
  .spinner {
    display: inline-block;
    width: 14px;
    height: 14px;
    border: 2px solid rgb(var(--tint-4));
    border-top-color: rgb(var(--primary-original));
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  /* White spinner for use on colored backgrounds */
  .spinner-white {
    border: 2px solid rgba(255, 255, 255, 0.3);
    border-top-color: white;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }
</style>
```

## Complete Variable Reference

### Color Scales (1-12 + original)

Each color has levels 1-12 plus `original` and `original-contrast`:

- `--primary-1` through `--primary-12`, `--primary-original`, `--primary-original-contrast`
- `--tint-1` through `--tint-12`
- `--success-1` through `--success-12`, `--success-original`, `--success-original-contrast`
- `--danger-1` through `--danger-12`, `--danger-original`, `--danger-original-contrast`
- `--warning-1` through `--warning-12`, `--warning-original`, `--warning-original-contrast`
- `--info-1` through `--info-12`, `--info-original`, `--info-original-contrast`
- `--neutral-1` through `--neutral-12`

### Usage Pattern

```css
/* Always use rgb() wrapper */
.element {
  background-color: rgb(var(--tint-2));
  color: rgb(var(--tint-12));
  border: 1px solid rgb(var(--tint-4));
}

/* For opacity, use rgba() with individual values */
.overlay {
  background-color: rgba(var(--tint-12), 0.5);
}
```
