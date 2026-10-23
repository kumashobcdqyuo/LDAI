/*
# Update trigger to handle anonymous users

## Overview
The app now uses anonymous authentication — users get a session automatically
without signing up. The `handle_new_user` trigger needs to provide a sensible
default name for anonymous users who don't have an email or user metadata.

## Changes
- Updated `handle_new_user()` to check `is_anonymous` flag and use a default
  name "学習者" for anonymous users instead of trying to extract from email.
*/

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, name, avatar_color)
  VALUES (
    NEW.id,
    CASE
      WHEN NEW.is_anonymous THEN COALESCE(NEW.raw_user_meta_data->>'name', '学習者')
      ELSE COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1))
    END,
    COALESCE(NEW.raw_user_meta_data->>'avatar_color', '#0d9488')
  );
  RETURN NEW;
END;
$$;
