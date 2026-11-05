/**
 * Customer notifications service tests (#35).
 *
 * Collin's model, pinned down:
 * - Opt-in per job, OFF by default, never fired by scheduling.
 * - Turning the toggle ON sends the Scheduled email at that moment.
 * - "On The Way" stamps once and emails once (only when opted in).
 * - Completion emails only when opted in.
 * - Recipient: primary contact email -> any contact email -> customer email.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const {
  getJobByIdMock,
  setEnabledMock,
  markEnRouteMock,
  createActivityMock,
  getCustomerByIdMock,
  listContactsMock,
  sendEmailMock,
} = vi.hoisted(() => ({
  getJobByIdMock: vi.fn(),
  setEnabledMock: vi.fn(),
  markEnRouteMock: vi.fn(),
  createActivityMock: vi.fn(),
  getCustomerByIdMock: vi.fn(),
  listContactsMock: vi.fn(),
  sendEmailMock: vi.fn(),
}));

vi.mock("@/repositories/jobs", () => ({
  getJobById: getJobByIdMock,
  setJobNotificationsEnabled: setEnabledMock,
  markJobEnRoute: markEnRouteMock,
  createJobActivity: createActivityMock,
}));

vi.mock("@/repositories/customers", () => ({
  getCustomerById: getCustomerByIdMock,
}));

vi.mock("@/repositories/customerContacts", () => ({
  listContactsByCustomerId: listContactsMock,
}));

vi.mock("@/lib/email", () => ({
  sendEmail: sendEmailMock,
}));

import {
  markJobEnRoute,
  notifyJobCompleted,
  resolveCustomerEmail,
  setJobNotifications,
} from "@/services/customerNotifications";
import type { Job } from "@/features/jobs/types/job";

function makeJob(overrides: Partial<Job> = {}): Job {
  return {
    id: "job-1",
    jobNumber: "JOB-1001",
    title: "Furnace install",
    type: "Install",
    status: "Scheduled",
    priority: "Medium",
    customerId: "cust-1",
    customerName: "Smith",
    propertyId: "prop-1",
    propertyName: "Smith residence",
    assignedTo: "",
    scheduledFor: "2026-11-10",
    scheduledStartAt: "2026-11-10T16:00:00.000Z",
    summary: "",
    location: "123 Main St, Seattle, WA",
    notes: "",
    customerNotificationsEnabled: false,
    enRouteAt: null,
    ...overrides,
  };
}

describe("customerNotifications", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    createActivityMock.mockResolvedValue(undefined);
    sendEmailMock.mockResolvedValue({ sent: true, providerId: "msg-1" });
    listContactsMock.mockResolvedValue([
      { id: "c1", email: "primary@example.com", isPrimary: true },
      { id: "c2", email: "other@example.com", isPrimary: false },
    ]);
    getCustomerByIdMock.mockResolvedValue({ email: "customer@example.com" });
  });

  it("resolves the primary contact's email first", async () => {
    await expect(resolveCustomerEmail(makeJob())).resolves.toBe(
      "primary@example.com",
    );
  });

  it("falls back to the customer email when no contact has one", async () => {
    listContactsMock.mockResolvedValue([{ id: "c1", email: "", isPrimary: true }]);
    await expect(resolveCustomerEmail(makeJob())).resolves.toBe(
      "customer@example.com",
    );
  });

  it("turning notifications ON sends the scheduled email immediately", async () => {
    setEnabledMock.mockResolvedValue(true);
    getJobByIdMock.mockResolvedValue(
      makeJob({ customerNotificationsEnabled: true }),
    );

    const outcome = await setJobNotifications("job-1", true);

    expect(setEnabledMock).toHaveBeenCalledWith("job-1", true);
    expect(sendEmailMock).toHaveBeenCalledTimes(1);
    expect(sendEmailMock.mock.calls[0][0]).toMatchObject({
      to: "primary@example.com",
      subject: "Your Legacy One Heating appointment is scheduled",
    });
    expect(outcome?.email.sent).toBe(true);
  });

  it("turning notifications OFF sends nothing", async () => {
    setEnabledMock.mockResolvedValue(true);
    getJobByIdMock.mockResolvedValue(makeJob());

    const outcome = await setJobNotifications("job-1", false);

    expect(sendEmailMock).not.toHaveBeenCalled();
    expect(outcome?.email.sent).toBe(false);
  });

  it("returns null when the job does not exist", async () => {
    setEnabledMock.mockResolvedValue(false);
    await expect(setJobNotifications("nope", true)).resolves.toBeNull();
    expect(sendEmailMock).not.toHaveBeenCalled();
  });

  it("on-the-way: first stamp emails when opted in", async () => {
    markEnRouteMock.mockResolvedValue(true);
    getJobByIdMock.mockResolvedValue(
      makeJob({
        customerNotificationsEnabled: true,
        enRouteAt: "2026-11-10T15:30:00.000Z",
      }),
    );

    const outcome = await markJobEnRoute("job-1");

    expect(outcome?.stamped).toBe(true);
    expect(sendEmailMock).toHaveBeenCalledTimes(1);
    expect(sendEmailMock.mock.calls[0][0].subject).toBe(
      "Your technician is on the way",
    );
  });

  it("on-the-way: repeat taps neither re-stamp nor re-email", async () => {
    markEnRouteMock.mockResolvedValue(false);
    getJobByIdMock.mockResolvedValue(
      makeJob({
        customerNotificationsEnabled: true,
        enRouteAt: "2026-11-10T15:30:00.000Z",
      }),
    );

    const outcome = await markJobEnRoute("job-1");

    expect(outcome?.stamped).toBe(false);
    expect(sendEmailMock).not.toHaveBeenCalled();
  });

  it("on-the-way: stamps silently when notifications are off", async () => {
    markEnRouteMock.mockResolvedValue(true);
    getJobByIdMock.mockResolvedValue(
      makeJob({ enRouteAt: "2026-11-10T15:30:00.000Z" }),
    );

    const outcome = await markJobEnRoute("job-1");

    expect(outcome?.stamped).toBe(true);
    expect(sendEmailMock).not.toHaveBeenCalled();
  });

  it("completion emails only when opted in", async () => {
    await notifyJobCompleted(makeJob({ customerNotificationsEnabled: true }));
    expect(sendEmailMock).toHaveBeenCalledTimes(1);
    expect(sendEmailMock.mock.calls[0][0].subject).toContain("complete");

    sendEmailMock.mockClear();
    await notifyJobCompleted(makeJob({ customerNotificationsEnabled: false }));
    expect(sendEmailMock).not.toHaveBeenCalled();
  });

  it("reports no_recipient instead of sending when there is no email anywhere", async () => {
    listContactsMock.mockResolvedValue([]);
    getCustomerByIdMock.mockResolvedValue({ email: "" });
    setEnabledMock.mockResolvedValue(true);
    getJobByIdMock.mockResolvedValue(
      makeJob({ customerNotificationsEnabled: true }),
    );

    const outcome = await setJobNotifications("job-1", true);

    expect(sendEmailMock).not.toHaveBeenCalled();
    expect(outcome?.email).toEqual({ sent: false, reason: "no_recipient" });
  });
});
