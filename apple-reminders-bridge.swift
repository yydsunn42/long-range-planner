import AppKit
import EventKit
import Foundation
import Darwin

struct SyncRow: Decodable {
    let key: String
    let title: String
    let date: String
    let notes: String
    let completed: Bool
    let reminderId: String?
    let lastCompleted: Bool?
}
struct Request: Decodable {
    let action: String
    let namespace: String?
    let listName: String?
    let calendarId: String?
    let rows: [SyncRow]?
    let deletions: [DeleteRow]?
}
struct DeleteRow: Decodable { let key: String; let reminderId: String; let keepReminderId: String? }
struct ReminderInventory: Encodable {
    let id: String
    let title: String
    let date: String?
    let completed: Bool
    let marker: String?
    let notes: String?
}
struct CalendarInventory: Encodable { let id: String; let title: String; let reminders: [ReminderInventory] }
struct RowResult: Encodable {
    let key: String
    var reminderId: String? = nil
    var completed: Bool? = nil
    var error: String? = nil
}
struct Response: Encodable {
    var ok = true
    var error: String? = nil
    var calendarId: String? = nil
    var rows: [RowResult]? = nil
    var deleted: [String]? = nil
    var inventory: [CalendarInventory]? = nil
}
struct BridgeError: LocalizedError {
    let message: String
    var errorDescription: String? { message }
}

@MainActor
final class BridgeDelegate: NSObject, NSApplicationDelegate {
    let store = EKEventStore()
    func applicationDidFinishLaunching(_ notification: Notification) {
        Task { await execute() }
    }
    func execute() async {
        let args = CommandLine.arguments
        guard args.count == 3 else { NSApp.terminate(nil); return }
        let output = URL(fileURLWithPath: args[2])
        let response: Response
        do {
            let input = try Data(contentsOf: URL(fileURLWithPath: args[1]))
            let request = try JSONDecoder().decode(Request.self, from: input)
            if request.action == "status" {
                let granted = EKEventStore.authorizationStatus(for: .reminder) == .fullAccess
                response = Response(ok: granted, error: granted ? nil : "尚未授权提醒事项")
            } else if request.action == "authorize" {
                try await authorize()
                response = Response()
            } else if request.action == "sync" {
                guard EKEventStore.authorizationStatus(for: .reminder) == .fullAccess else {
                    throw BridgeError(message: "请点击连接并允许访问提醒事项；不会自动重复申请权限。")
                }
                response = try await synchronize(request)
            } else if request.action == "deleteDuplicates" {
                guard EKEventStore.authorizationStatus(for: .reminder) == .fullAccess else { throw BridgeError(message: "请先重新连接并授权提醒事项。") }
                response = try await deleteDuplicates(request)
            } else if request.action == "inspect" {
                guard EKEventStore.authorizationStatus(for: .reminder) == .fullAccess else { throw BridgeError(message: "请先重新连接并授权提醒事项。") }
                response = try await inspect(request)
            } else { throw BridgeError(message: "不支持的操作") }
        } catch { response = Response(ok: false, error: error.localizedDescription) }
        do { try JSONEncoder().encode(response).write(to: output, options: .atomic) }
        catch { /* The plugin may have closed and removed its private request directory. */ }
        NSApp.terminate(nil)
    }
    func authorize() async throws {
        if EKEventStore.authorizationStatus(for: .reminder) == .fullAccess { return }
        NSApp.activate(ignoringOtherApps: true)
        guard try await store.requestFullAccessToReminders() else {
            throw BridgeError(message: "未获得提醒事项权限。可在系统设置 → 隐私与安全性 → 提醒事项中允许 Long Range Planner 提醒事项连接。")
        }
    }
    func reminderIDs(in calendar: EKCalendar) async throws -> [String] {
        try await withCheckedThrowingContinuation { continuation in
            store.fetchReminders(matching: store.predicateForReminders(in: [calendar])) { reminders in
                if let reminders { continuation.resume(returning: reminders.map(\.calendarItemIdentifier)) }
                else { continuation.resume(throwing: BridgeError(message: "无法读取提醒事项，已停止同步。")) }
            }
        }
    }
    func targetCalendar(_ request: Request) throws -> EKCalendar {
        if let id = request.calendarId {
            guard let calendar = store.calendar(withIdentifier: id), calendar.allowedEntityTypes.contains(.reminder), calendar.allowsContentModifications else {
                throw BridgeError(message: "关联的提醒事项列表已移除或只读，已停止同步以避免重复创建。")
            }
            return calendar
        }
        guard let title = request.listName, !title.isEmpty else { throw BridgeError(message: "列表名称无效") }
        // Recover the same list if a prior process saved it before the plugin acknowledged its ID.
        let matches = store.calendars(for: .reminder).filter { $0.title == title }
        guard matches.count <= 1 else { throw BridgeError(message: "存在同名同步列表，请先处理重复列表。") }
        if let calendar = matches.first {
            guard calendar.allowsContentModifications else { throw BridgeError(message: "同步列表不可写") }
            return calendar
        }
        guard let source = store.defaultCalendarForNewReminders()?.source else {
            throw BridgeError(message: "没有可写的提醒事项账户，请先打开苹果提醒事项完成账户设置。")
        }
        let calendar = EKCalendar(for: .reminder, eventStore: store)
        calendar.title = title
        calendar.source = source
        try store.saveCalendar(calendar, commit: true)
        return calendar
    }
    func dueComponents(_ value: String) throws -> DateComponents {
        let parts = value.split(separator: "-").compactMap { Int($0) }
        guard parts.count == 3 else { throw BridgeError(message: "子任务日期无效") }
        let gregorian = Calendar(identifier: .gregorian)
        let components = DateComponents(calendar: gregorian, year: parts[0], month: parts[1], day: parts[2])
        guard let date = gregorian.date(from: components),
              gregorian.component(.year, from: date) == parts[0],
              gregorian.component(.month, from: date) == parts[1],
              gregorian.component(.day, from: date) == parts[2] else { throw BridgeError(message: "子任务日期无效") }
        return components // No time or zone: floating, all-day reminder.
    }
    func marker(namespace: String, key: String) throws -> URL {
        let encoded = Data(key.utf8).base64EncodedString().replacingOccurrences(of: "+", with: "-").replacingOccurrences(of: "/", with: "_").replacingOccurrences(of: "=", with: "")
        guard let url = URL(string: "lrp-planner-reminder://\(namespace.lowercased())/\(encoded)") else { throw BridgeError(message: "子任务标识无效") }
        return url
    }
    func lock(_ namespace: String) throws -> Int32 {
        let path = NSTemporaryDirectory() + "lrp-reminders-" + namespace.lowercased() + ".lock"
        let descriptor = Darwin.open(path, O_CREAT | O_RDWR, S_IRUSR | S_IWUSR)
        guard descriptor >= 0 else { throw BridgeError(message: "无法建立同步锁") }
        guard flock(descriptor, LOCK_EX | LOCK_NB) == 0 else {
            Darwin.close(descriptor)
            throw BridgeError(message: "另一个同步正在进行，请稍后重试。")
        }
        return descriptor
    }
    func inspect(_ request: Request) async throws -> Response {
        var inventory: [CalendarInventory] = []
        for calendar in store.calendars(for: .reminder) where calendar.title.hasPrefix("long-range-planner") || calendar.calendarIdentifier == request.calendarId {
            let ids = try await reminderIDs(in: calendar)
            let reminders = ids.compactMap { store.calendarItem(withIdentifier: $0) as? EKReminder }
            let rows = reminders.map { reminder in
                let due = reminder.dueDateComponents
                let date: String?
                if let y = due?.year, let m = due?.month, let d = due?.day { date = String(format: "%04d-%02d-%02d", y, m, d) }
                else { date = nil }
                return ReminderInventory(id: reminder.calendarItemIdentifier, title: reminder.title ?? "", date: date,
                    completed: reminder.isCompleted, marker: reminder.url?.absoluteString, notes: reminder.notes)
            }
            inventory.append(CalendarInventory(id: calendar.calendarIdentifier, title: calendar.title, reminders: rows))
        }
        return Response(inventory: inventory)
    }
    // Explicit, bounded maintenance request. Normal sync never propagates deletions.
    func deleteDuplicates(_ request: Request) async throws -> Response {
        guard let namespace = request.namespace, UUID(uuidString: namespace) != nil,
              let id = request.calendarId, let calendar = store.calendar(withIdentifier: id),
              calendar.allowsContentModifications, let rows = request.deletions,
              !rows.isEmpty, rows.count <= 200, Set(rows.map(\.reminderId)).count == rows.count else {
            throw BridgeError(message: "重复条目清理清单无效，未执行删除。")
        }
        let descriptor = try lock(namespace)
        defer { flock(descriptor, LOCK_UN); Darwin.close(descriptor) }
        let ids = try await reminderIDs(in: calendar)
        let reminders = ids.compactMap { store.calendarItem(withIdentifier: $0) as? EKReminder }
        var selected: [EKReminder] = []
        var markers: Set<String> = []
        // Validate every match before staging any removal; never delete by title.
        for row in rows {
            let url = try marker(namespace: namespace, key: row.key).absoluteString
            markers.insert(url)
            let matches = reminders.filter { $0.url?.absoluteString == url }
            if let keep = row.keepReminderId {
                guard keep != row.reminderId, reminders.contains(where: { $0.calendarItemIdentifier == keep }) else { throw BridgeError(message: "保留的提醒事项不存在，未执行删除。") }
            } else {
                guard matches.count <= 1 else { throw BridgeError(message: "存在异常的重复关联，未执行删除。") }
            }
            if let reminder = matches.first(where: { $0.calendarItemIdentifier == row.reminderId }) {
                selected.append(reminder)
            } else if !matches.isEmpty && row.keepReminderId == nil {
                throw BridgeError(message: "提醒事项标识已变化，请刷新清理清单。")
            }
        }
        do {
            for reminder in selected { try store.remove(reminder, commit: false) }
            if !selected.isEmpty { try store.commit() }
        } catch { store.reset(); throw error }
        let remainingIDs = try await reminderIDs(in: calendar)
        let remaining = remainingIDs.compactMap { store.calendarItem(withIdentifier: $0) as? EKReminder }
        let deletedIDs = Set(rows.map(\.reminderId))
        let entirelyRemovedMarkers = Set(try rows.filter { $0.keepReminderId == nil }.map { try marker(namespace: namespace, key: $0.key).absoluteString })
        guard !remaining.contains(where: { deletedIDs.contains($0.calendarItemIdentifier) || entirelyRemovedMarkers.contains($0.url?.absoluteString ?? "") }),
              rows.compactMap(\.keepReminderId).allSatisfy({ keep in remaining.contains(where: { $0.calendarItemIdentifier == keep }) }) else {
            throw BridgeError(message: "苹果端删除尚未全部确认，请刷新后重试。")
        }
        return Response(deleted: rows.map(\.key))
    }
    func synchronize(_ request: Request) async throws -> Response {
        guard let namespace = request.namespace, UUID(uuidString: namespace) != nil else { throw BridgeError(message: "同步标识无效") }
        let descriptor = try lock(namespace)
        defer { flock(descriptor, LOCK_UN); Darwin.close(descriptor) }
        let rows = request.rows ?? []
        guard Set(rows.map(\.key)).count == rows.count else { throw BridgeError(message: "子任务标识重复，已停止同步") }
        let calendar = try targetCalendar(request)
        let identifiers = try await reminderIDs(in: calendar)
        let existing = identifiers.compactMap { store.calendarItem(withIdentifier: $0) as? EKReminder }
        let grouped = Dictionary(grouping: existing.filter { $0.url != nil }, by: { $0.url?.absoluteString ?? "" })
        var results: [RowResult] = []
        for row in rows {
            do {
                let marker = try marker(namespace: namespace, key: row.key)
                let matches = grouped[marker.absoluteString] ?? []
                guard matches.count <= 1 else { throw BridgeError(message: "同一子任务存在重复关联，已跳过") }
                let reminder: EKReminder
                if let found = matches.first { reminder = found }
                else {
                    // Never treat an Apple-side deletion or moved item as a completion or a request to recreate.
                    guard row.reminderId == nil else { throw BridgeError(message: "关联待办已移除或移出同步列表，已保留插件任务") }
                    reminder = EKReminder(eventStore: store)
                    reminder.calendar = calendar
                    reminder.url = marker
                }
                let completion = row.lastCompleted == nil || row.completed != row.lastCompleted ? row.completed : reminder.isCompleted
                let due = try dueComponents(row.date)
                var changed = reminder.calendarItemIdentifier.isEmpty || matches.isEmpty
                if reminder.title != row.title { reminder.title = row.title; changed = true }
                if reminder.notes != row.notes { reminder.notes = row.notes; changed = true }
                let oldDue = reminder.dueDateComponents
                if oldDue?.year != due.year || oldDue?.month != due.month || oldDue?.day != due.day || oldDue?.hour != nil || oldDue?.minute != nil {
                    reminder.dueDateComponents = due; changed = true
                }
                if reminder.isCompleted != completion { reminder.isCompleted = completion; changed = true }
                if changed { try store.save(reminder, commit: true) }
                results.append(RowResult(key: row.key, reminderId: reminder.calendarItemIdentifier, completed: completion))
            } catch {
                results.append(RowResult(key: row.key, error: error.localizedDescription))
            }
        }
        return Response(calendarId: calendar.calendarIdentifier, rows: results)
    }
}

let app = NSApplication.shared
let delegate = BridgeDelegate()
app.delegate = delegate
app.setActivationPolicy(.accessory)
app.run()
