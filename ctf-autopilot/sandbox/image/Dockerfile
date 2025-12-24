# CTF Autopilot Sandbox Image
# Secure, isolated container for CTF challenge analysis
#
# Security features:
# - Non-root user execution
# - No network access (enforced at runtime)
# - Read-only filesystem (enforced at runtime)
# - Resource limits (enforced at runtime)

FROM ubuntu:24.04

LABEL maintainer="CTF Autopilot Team"
LABEL description="Secure sandbox for CTF challenge analysis"
LABEL version="1.0.0"

# Prevent interactive prompts during installation
ENV DEBIAN_FRONTEND=noninteractive

# Install analysis tools for CTF challenges
RUN apt-get update && apt-get install -y --no-install-recommends \
    # Binary analysis (binutils includes strings, objdump, nm, readelf, size, etc.)
    binutils \
    binwalk \
    file \
    elfutils \
    patchelf \
    # Hex/Binary viewing
    xxd \
    bsdmainutils \
    # Text processing
    gawk \
    grep \
    sed \
    coreutils \
    # Document analysis (poppler-utils includes pdfinfo, pdftotext, pdfimages)
    poppler-utils \
    pdftk-java \
    # Image/media analysis & steganography
    libimage-exiftool-perl \
    imagemagick \
    steghide \
    foremost \
    pngcheck \
    pngcrush \
    optipng \
    # Network analysis
    tshark \
    tcpdump \
    ssldump \
    # Archive handling
    unzip \
    p7zip-full \
    gzip \
    bzip2 \
    xz-utils \
    tar \
    unrar \
    cabextract \
    fcrackzip \
    # Scripting runtimes
    python3 \
    python3-pip \
    python3-venv \
    python3-dev \
    build-essential \
    cmake \
    git \
    # Crypto tools
    openssl \
    john \
    hashcat \
    # Hex editors
    hexedit \
    # QR/Barcode
    zbar-tools \
    # Audio/Video analysis
    sox \
    ffmpeg \
    libsox-fmt-all \
    # Memory/Disk forensics
    testdisk \
    # Reverse engineering
    radare2 \
    # Debugging tools
    gdb \
    gdb-multiarch \
    ltrace \
    strace \
    # Additional utilities
    jq \
    less \
    ca-certificates \
    netcat-openbsd \
    curl \
    wget \
    libxml2-utils \
    # Required for some Python packages
    libffi-dev \
    libssl-dev \
    && rm -rf /var/lib/apt/lists/* \
    && apt-get clean

# Install RetDec decompiler
RUN mkdir -p /opt/retdec && cd /opt/retdec \
    && curl -LO https://github.com/avast/retdec/releases/download/v5.0/RetDec-v5.0-Linux-Release.tar.xz \
    && tar -xf RetDec-v5.0-Linux-Release.tar.xz \
    && rm RetDec-v5.0-Linux-Release.tar.xz \
    && ln -s /opt/retdec/retdec/bin/retdec-decompiler /usr/local/bin/retdec-decompiler \
    && ln -s /opt/retdec/retdec/bin/retdec-fileinfo /usr/local/bin/retdec-fileinfo \
    && ln -s /opt/retdec/retdec/bin/retdec-unpacker /usr/local/bin/retdec-unpacker

# Install checksec
RUN curl -Lo /usr/local/bin/checksec https://raw.githubusercontent.com/slimm609/checksec.sh/master/checksec \
    && chmod +x /usr/local/bin/checksec

# Install Python analysis libraries
RUN pip3 install --no-cache-dir --break-system-packages \
    # Core crypto/pwn
    pycryptodome \
    pwntools \
    # Image analysis
    pillow \
    # PDF analysis
    pypdf2 \
    # Steganography
    zsteg \
    stegcracker \
    # Hash identification
    name-that-hash \
    search-that-hash \
    # ROP tools
    ropper \
    ROPgadget \
    one_gadget \
    # Symbolic execution (lightweight)
    z3-solver \
    # Disassembly
    capstone \
    keystone-engine \
    unicorn \
    # Volatility for memory forensics
    volatility3 \
    # Radare2 Python bindings
    r2pipe

# Create non-root user for sandbox execution
RUN groupadd -r sandbox && useradd -r -g sandbox -d /sandbox -s /bin/bash sandbox

# Create working directories
RUN mkdir -p /sandbox/input /sandbox/output /sandbox/tmp \
    && chown -R sandbox:sandbox /sandbox

# Set working directory
WORKDIR /sandbox

# Switch to non-root user
USER sandbox

# Default command (overridden at runtime)
CMD ["/bin/bash"]
