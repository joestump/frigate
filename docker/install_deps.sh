#!/bin/bash

set -euxo pipefail

apt-get -qq update

apt-get -qq install --no-install-recommends -y \
    apt-transport-https \
    gnupg \
    wget \
    procps \
    unzip locales tzdata libxml2 xz-utils \
    python3-pip

# add raspberry pi repo
apt-key adv --keyserver keyserver.ubuntu.com --recv-keys 9165938D90FDDD2E
echo "deb http://raspbian.raspberrypi.org/raspbian/ bullseye main contrib non-free rpi" | tee /etc/apt/sources.list.d/raspi.list

# add coral repo
apt-key adv --fetch-keys https://packages.cloud.google.com/apt/doc/apt-key.gpg
echo "deb https://packages.cloud.google.com/apt coral-edgetpu-stable main" >/etc/apt/sources.list.d/coral-edgetpu.list
echo "libedgetpu1-max libedgetpu/accepted-eula select true" | debconf-set-selections

# enable non-free repo
sed -i -e's/ main/ main contrib non-free/g' /etc/apt/sources.list

# coral drivers
apt-get -qq update
apt-get -qq install --no-install-recommends --no-install-suggests -y \
    libedgetpu1-max python3-tflite-runtime python3-pycoral
pip3 install -U /deps/wheels/*.whl

# btbn-ffmpeg -> amd64 / arm64
if [[ "${TARGETARCH}" == "amd64" || "${TARGETARCH}" == "arm64" ]]; then
    if [[ "${TARGETARCH}" == "amd64" ]]; then
        btbn_arch="64"
    else
        btbn_arch="arm64"
    fi
    mkdir -p /usr/lib/btbn-ffmpeg
    wget -qO btbn-ffmpeg.tar.xz "https://github.com/BtbN/FFmpeg-Builds/releases/download/autobuild-2022-07-31-12-37/ffmpeg-n5.1-2-g915ef932a3-linux${btbn_arch}-gpl-5.1.tar.xz"
    tar -xf btbn-ffmpeg.tar.xz -C /usr/lib/btbn-ffmpeg --strip-components 1
    rm -rf btbn-ffmpeg.tar.xz /usr/lib/btbn-ffmpeg/doc /usr/lib/btbn-ffmpeg/bin/ffplay
fi

# ffmpeg -> arm32
if [[ "${TARGETARCH}" == "arm" ]]; then
    apt-get -qq install --no-install-recommends --no-install-suggests -y ffmpeg
fi

# arch specific packages
if [[ "${TARGETARCH}" == "amd64" ]]; then
    # Use debian testing repo only for hwaccel packages
    echo 'deb http://deb.debian.org/debian testing main non-free' >/etc/apt/sources.list.d/debian-testing.list
    apt-get -qq update
    apt-get -qq install --no-install-recommends --no-install-suggests -y \
        mesa-va-drivers libva-drm2 intel-media-va-driver-non-free i965-va-driver libmfx1
    rm -f /etc/apt/sources.list.d/debian-testing.list
fi

if [[ "${TARGETARCH}" == "arm64" ]]; then
    apt-get -qq install --no-install-recommends --no-install-suggests -y \
        libva-drm2 mesa-va-drivers
fi

# not sure why 32bit arm requires all these
if [[ "${TARGETARCH}" == "arm" ]]; then
    apt-get -qq install --no-install-recommends --no-install-suggests -y \
        libgtk-3-dev \
        libavcodec-dev libavformat-dev libswscale-dev libv4l-dev \
        libxvidcore-dev libx264-dev libjpeg-dev libpng-dev libtiff-dev \
        gfortran openexr libatlas-base-dev libssl-devlibtbb2 libtbb-dev libdc1394-22-dev libopenexr-dev \
        libgstreamer-plugins-base1.0-dev libgstreamer1.0-dev
fi

apt-get purge gnupg apt-transport-https wget -y
apt-get clean autoclean -y
apt-get autoremove --purge -y
rm -rf /var/lib/apt/lists/*
