import { v7, validate } from 'uuid';

export const newId = (): string => v7();
export const isUuid = (s: string): boolean => validate(s);
