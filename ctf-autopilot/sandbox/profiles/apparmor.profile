# CTF Autopilot Sandbox AppArmor Profile
# Provides additional security restrictions for sandbox containers

#include <tunables/global>

profile ctf-autopilot-sandbox flags=(attach_disconnected,mediate_deleted) {
  #include <abstractions/base>
  #include <abstractions/nameservice>

  # Deny network access
  deny network inet,
  deny network inet6,
  deny network raw,
  deny network packet,

  # Allow read access to system files
  /etc/** r,
  /usr/** r,
  /lib/** r,
  /lib64/** r,
  /bin/** rix,
  /usr/bin/** rix,
  /usr/local/bin/** rix,

  # Allow read/write in sandbox directory
  /sandbox/** rw,
  /sandbox/input/** r,
  /sandbox/output/** rw,
  /sandbox/tmp/** rw,

  # Deny access to sensitive directories
  deny /root/** rwklx,
  deny /home/** rwklx,
  deny /etc/shadow r,
  deny /etc/passwd w,
  deny /proc/*/mem rwklx,
  deny /sys/** w,

  # Allow basic proc access (read-only)
  /proc/*/status r,
  /proc/*/stat r,
  /proc/*/maps r,
  /proc/meminfo r,
  /proc/cpuinfo r,

  # Deny ptrace
  deny ptrace,

  # Deny mount operations
  deny mount,
  deny umount,
  deny pivot_root,

  # Deny kernel module operations
  deny @{PROC}/sys/kernel/** w,
  deny /sys/kernel/** w,
}
