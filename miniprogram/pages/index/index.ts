// pages/index/index.ts
Page({
  /**
   * 页面的初始数据
   */
  data: Object({
    SYS: wx.getSystemInfoSync(),
    options: {
      initWidth: 200,
      initHeight: 200,
      maxWidth: 300,
      maxHeight: 300,
      minWidth: 100,
      minHeight: 100,
      maxScale: 3,
      minScale: 0.5
    }
  }),

  // 获取夹角
  getAngle(touches: WechatMiniprogram.TouchDetail[]) {
    const X = touches[0].clientX - touches[1].clientX
    const Y = touches[0].clientY - touches[1].clientY
    return (Math.atan2(Y, X) * 180) / Math.PI
  },

  // 获取距离
  getDistance(touches: WechatMiniprogram.TouchDetail[]) {
    const X = Math.abs(touches[0].clientX - touches[1].clientX)
    const Y = Math.abs(touches[0].clientY - touches[1].clientY)
    return Math.sqrt(Math.pow(X, 2) + Math.pow(Y, 2))
  },

  // 获取触摸索引
  getTouchIndex(touches: WechatMiniprogram.TouchDetail[], touche: WechatMiniprogram.TouchDetail) {
    return touches.findIndex(({ clientX, clientY }) => clientX === touche.clientX && clientY === touche.clientY)
  },

  // 四舍五入
  getRound(value: number, decimal: number = 8) {
    const length = Number(`1${Array(decimal).fill(0).join('')}`)
    return Math.round((value + Number.EPSILON) * length) / length
  },

  // 样式字符串
  getStyle(point: { [key: string]: number }, prefix: string, extend: string[] = []) {
    const ext = Object({ rotate: 'deg', scale: ' ', scaleX: ' ' })
    const styles: string[] = []

    Object.keys(point)
      .map((key) => {
        point[key] = this.getRound(point[key])
        return key
      })
      .filter((key) => !/(scaleHW|scaleWH)/.test(key))
      .map((key) => {
        // 如果开启镜像，则反向旋转
        const value = point[key] * (key === 'rotate' ? point.scaleX : 1)
        styles.push(`--${prefix}-${key}:${value + (ext[key] || 'px')}`)
      })

    return styles.concat(extend).join(';')
  },

  // 滑块移动
  sliderChange({ detail }: WechatMiniprogram.SliderChange) {
    const { imgPoint } = this.data
    imgPoint.rotate = detail.value
    this.setData({
      maskStyle: '--mask-opacity:0.5',
      imgPoint,
      imgStyle: this.getStyle(imgPoint, 'img')
    })
    setTimeout(() => this.setData({ maskStyle: '--mask-opacity:0.8' }), 1000)
  },

  // 切换状态
  switchChange({ detail, currentTarget }: WechatMiniprogram.SwitchChange) {
    const { limit, cutPoint, imgPoint } = this.data
    const { key } = currentTarget.dataset
    limit[key].value = detail.value
    if (key === 'move' && detail.value) {
      limit.rotate.value = !detail.value

      // 计算旋转角度，若大于45度，则向前旋转
      const surplus = imgPoint.rotate % 90
      imgPoint.rotate -= surplus - (surplus > 45 ? 90 : 0)

      wx.nextTick(() => {
        this.fill(cutPoint, imgPoint)
        this.setData({
          imgPoint,
          imgStyle: this.getStyle(imgPoint, 'img', ['--img-transition-duration:0.4s'])
        })
      })
    }
    if (key === 'rotate' && detail.value) {
      limit.move.value = !detail.value
    }
    if (key === 'mirror') {
      imgPoint.scaleX = detail.value ? -1 : 1
      wx.nextTick(() => {
        this.fill(cutPoint, imgPoint)
        this.setData({
          imgPoint,
          imgStyle: this.getStyle(imgPoint, 'img', ['--img-transition-duration:0.4s'])
        })
      })
    }
    this.setData({ limit, maskStyle: '--mask-opacity:0.8' })
  },

  // 初始化
  init() {
    const { SYS, options } = this.data
    const { windowWidth, windowHeight } = SYS
    const left = (windowWidth - options.initWidth) / 2
    const top = (windowHeight - options.initHeight) / 2 - 30
    const width = options.initWidth
    const height = options.initHeight
    const cutPoint = Object({ top, left, width, height })
    const imgPoint = this.data.imgPoint || {}

    if (imgPoint.width) {
      const width = imgPoint.scaleHW ? cutPoint.height / imgPoint.scaleHW : cutPoint.width
      const height = imgPoint.scaleWH ? cutPoint.width / imgPoint.scaleWH : cutPoint.height
      const left = (windowWidth - width) / 2
      const top = (windowHeight - height) / 2 - 30
      Object.assign(imgPoint, { top, left, width, height, rotate: 0, scale: 1, scaleX: 1 })
    }

    this.setData({
      limit: {
        scale: { name: '锁定比例', value: true },
        width: { name: '锁定宽', value: false },
        height: { name: '锁定高', value: false },
        rotate: { name: '自由旋转', value: false },
        move: { name: '限制移动', value: true },
        mirror: { name: '镜像', value: false }
      },
      maskStyle: '',
      cutPoint,
      cutStyle: this.getStyle(cutPoint, 'cut', ['--cut-transition-duration:0.4s']),
      imgPoint,
      imgStyle: this.getStyle(imgPoint, 'img', ['--img-transition-duration:0.4s'])
    })
  },

  // 上传图片
  async upload() {
    try {
      const { tempFiles } = await wx.chooseMedia({
        count: 1,
        mediaType: ['image']
      })
      this.init()
      this.setData({ imgSrc: tempFiles.pop()?.tempFilePath })
    } catch (error) {}
  },

  // 图片加载完成
  load({ detail }: WechatMiniprogram.ImageLoad) {
    const { cutPoint } = this.data
    const imgPoint = Object({ rotate: 0, scale: 1, scaleX: 1 })

    // 填充剪裁框宽高
    if (cutPoint.width > cutPoint.height) {
      if (cutPoint.width / (detail.width / detail.height) > cutPoint.height) {
        imgPoint.scaleWH = detail.width / detail.height
      } else {
        imgPoint.scaleHW = detail.height / detail.width
      }
    } else {
      if (cutPoint.height / (detail.height / detail.width) > cutPoint.width) {
        imgPoint.scaleHW = detail.height / detail.width
      } else {
        imgPoint.scaleWH = detail.width / detail.height
      }
    }
    if (imgPoint.scaleHW) {
      const width = cutPoint.height / imgPoint.scaleHW
      imgPoint.top = cutPoint.top
      imgPoint.left = cutPoint.left - (width - cutPoint.width) / 2
      imgPoint.width = width
      imgPoint.height = cutPoint.height
    }
    if (imgPoint.scaleWH) {
      const height = cutPoint.width / imgPoint.scaleWH
      imgPoint.top = cutPoint.top - (height - cutPoint.height) / 2
      imgPoint.left = cutPoint.left
      imgPoint.width = cutPoint.width
      imgPoint.height = height
    }

    this.setData({
      imgPoint,
      imgStyle: this.getStyle(imgPoint, 'img')
    })
  },

  // 移动图片
  imgTouch({ type, touches }: WechatMiniprogram.TouchEvent) {
    const { SYS, options, limit, cutPoint, imgPoint } = this.data
    const imgInit = this.data.imgInit || {}

    if (!imgPoint.width) return

    if (/touchstart/i.test(type)) {
      if (touches.length === 1) {
        // 记录坐标
        const [{ clientX, clientY }] = touches
        Object.assign(imgInit, { clientX, clientY })
      }
      if (touches.length > 1) {
        // 记录初始值
        Object.assign(imgInit, {
          touches,
          hypotenuse: this.getDistance(touches),
          width: imgPoint.width * imgPoint.scale,
          height: imgPoint.height * imgPoint.scale
        })
      }
      this.setData({ imgInit })
    }
    if (/touchmove/i.test(type)) {
      if (!Object.keys(imgInit).length) return

      if (touches.length === 1) {
        const [{ clientX, clientY }] = touches

        // 坐标不能超出范围
        if (clientX < 0 || clientX > SYS.windowWidth) return
        if (clientY < 0 || clientY > SYS.windowHeight) return

        const imgWidth = imgPoint.width * imgPoint.scale
        const imgHeight = imgPoint.height * imgPoint.scale
        const cover = Object({
          top: (imgHeight - imgPoint.height) / 2,
          left: (imgWidth - imgPoint.width) / 2,
          width: imgWidth,
          height: imgHeight
        })

        imgPoint.top += clientY - imgInit.clientY
        imgPoint.left += clientX - imgInit.clientX

        // 记录坐标
        Object.assign(imgInit, { clientX, clientY })

        // 限制移动范围
        if (limit.move.value) {
          // 纵向，宽高对换
          if ((imgPoint.rotate / 90) % 2) {
            const diff = Math.abs(imgWidth - imgHeight) / 2
            cover.top += diff * (imgPoint.scaleHW ? 1 : -1)
            cover.left += diff * (imgPoint.scaleWH ? 1 : -1)
            cover.width = imgHeight
            cover.height = imgWidth
          }

          const maxTop = cutPoint.top + cover.top
          const minTop = cutPoint.top + cutPoint.height - cover.height + cover.top
          const maxLeft = cutPoint.left + cover.left
          const minLeft = cutPoint.left + cutPoint.width - cover.width + cover.left
          imgPoint.top = Math.max(Math.min(imgPoint.top, maxTop), minTop)
          imgPoint.left = Math.max(Math.min(imgPoint.left, maxLeft), minLeft)
        }
      }
      if (touches.length > 1) {
        // 计算斜边长度
        const hypotenuse = this.getDistance(touches)

        // 计算缩放比例
        const length = Math.min(imgInit.width, imgInit.height) + (hypotenuse - imgInit.hypotenuse)
        const scale = length / Math.min(imgPoint.width, imgPoint.height)
        imgPoint.scale = Math.min(Math.max(scale, limit.move.value ? 1 : options.minScale), options.maxScale)

        // 开启自由旋转
        if (limit.rotate.value) {
          // 计算旋转角度
          const rotate = imgPoint.rotate + this.getAngle(touches) - this.getAngle(imgInit.touches)
          imgPoint.rotate = Math.max(Math.min(this.getRound(rotate, 2), 360), -360)
          Object.assign(imgInit, { touches })
        }
      }

      this.setData({
        maskStyle: '--mask-opacity:0.5',
        imgInit,
        imgPoint,
        imgStyle: this.getStyle(imgPoint, 'img')
      })
    }
    if (/touchend/i.test(type)) {
      delete this.data.imgInit
      setTimeout(() => this.setData({ maskStyle: '--mask-opacity:0.8' }), 1000)
    }
  },

  // 剪裁图片
  cutTouch({ type, currentTarget, touches: [touche] }: WechatMiniprogram.TouchEvent) {
    const { SYS, options, limit, cutPoint, imgPoint } = this.data
    const { target } = currentTarget.dataset
    const cutInit = this.data.cutInit || {}

    // 图片定位不存在
    if (!imgPoint.width) return
    // 宽与高都锁定
    if (limit.width.value && limit.height.value) return
    // 锁定比例 + 宽/高锁定
    if (limit.scale.value && (limit.width.value || limit.height.value)) return

    if (/touchstart/i.test(type)) {
      // 记录坐标
      Object.assign(cutInit, {
        clientX: touche.clientX,
        clientY: touche.clientY
      })
      this.setData({ cutInit })
    }
    if (/touchmove/i.test(type)) {
      if (!Object.keys(cutInit).length) return
      // 坐标不能超出范围
      if (touche.clientX < 0 || touche.clientX > SYS.windowWidth) return
      if (touche.clientY < 0 || touche.clientY > SYS.windowHeight) return

      const box = Object({
        T: touche.clientY - cutInit.clientY,
        R: cutInit.clientX - touche.clientX,
        B: cutInit.clientY - touche.clientY,
        L: touche.clientX - cutInit.clientX
      })
      const top = box[target.substr(limit.scale.value ? 1 : 0, 1)]
      const left = box[target.substr(1, 1)]
      const maxTop = cutPoint.top + cutPoint.height - options.minHeight
      const minTop = cutPoint.top + cutPoint.height - options.maxHeight
      const maxLeft = cutPoint.left + cutPoint.width - options.minWidth
      const minLeft = cutPoint.left + cutPoint.width - options.maxWidth

      if (!limit.height.value && /^T$/.test(target.substr(0, 1))) {
        cutPoint.top = Math.min(Math.max(cutPoint.top + top, minTop), maxTop)
      }
      if (!limit.width.value && /^L$/.test(target.substr(1, 1))) {
        cutPoint.left = Math.min(Math.max(cutPoint.left + left, minLeft), maxLeft)
      }

      if (!limit.width.value)
        cutPoint.width = Math.max(Math.min(cutPoint.width - left, options.maxWidth), options.minWidth)
      if (!limit.height.value)
        cutPoint.height = Math.max(Math.min(cutPoint.height - top, options.maxHeight), options.minHeight)

      // 记录坐标
      Object.assign(cutInit, {
        clientX: touche.clientX,
        clientY: touche.clientY
      })

      limit.move.value && this.fill(cutPoint, imgPoint)

      this.setData({
        maskStyle: '--mask-opacity:0.5',
        cutInit,
        cutPoint,
        cutStyle: this.getStyle(cutPoint, 'cut'),
        imgPoint,
        imgStyle: this.getStyle(imgPoint, 'img')
      })
    }
    if (/touchend/i.test(type)) {
      delete this.data.cutInit
      this.alignCenter()
    }
  },

  // 填充宽度
  fillWidth(
    cutPoint: { [key: string]: number },
    imgPoint: { [key: string]: number },
    cover: { [key: string]: number },
    vertical: number
  ) {
    imgPoint.scale = cutPoint.width / imgPoint.width

    Object.assign(cover, { width: imgPoint.width * imgPoint.scale, height: imgPoint.height * imgPoint.scale })
    vertical && Object.assign(cover, { width: cover.height, height: cover.width })

    imgPoint.left = cutPoint.left + (cover.width - imgPoint.width) / 2
  },
  // 填充高度
  fillHeight(
    cutPoint: { [key: string]: number },
    imgPoint: { [key: string]: number },
    cover: { [key: string]: number },
    vertical: number
  ) {
    imgPoint.scale = cutPoint.height / imgPoint.height

    Object.assign(cover, { width: imgPoint.width * imgPoint.scale, height: imgPoint.height * imgPoint.scale })
    vertical && Object.assign(cover, { width: cover.height, height: cover.width })

    imgPoint.top = cutPoint.top + (cover.height - imgPoint.height) / 2
  },
  // 填充图片
  fill(cutPoint: { [key: string]: number }, imgPoint: { [key: string]: number }) {
    if (!imgPoint.width) return

    // 图片是否纵向
    const vertical = (imgPoint.rotate / 90) % 2
    // 图片放大比例宽高
    const cover = Object({ width: imgPoint.width * imgPoint.scale, height: imgPoint.height * imgPoint.scale })
    // 纵向，宽高对换
    vertical && Object.assign(cover, { width: cover.height, height: cover.width })

    // 填充宽度
    cutPoint.width > cover.width && this.fillWidth(cutPoint, imgPoint, cover, vertical)
    // 填充高度
    cutPoint.height > cover.height && this.fillHeight(cutPoint, imgPoint, cover, vertical)
    // 修正宽度
    cutPoint.width > cover.width && this.fillWidth(cutPoint, imgPoint, cover, vertical)

    // 移动到剪裁框边缘
    const top = cutPoint.top + (cover.height - imgPoint.height) / 2
    const left = cutPoint.left + (cover.width - imgPoint.width) / 2
    imgPoint.top = Math.max(Math.min(top, imgPoint.top), top + cutPoint.height - cover.height)
    imgPoint.left = Math.max(Math.min(left, imgPoint.left), left + cutPoint.width - cover.width)
  },

  // 居中显示
  alignCenter() {
    setTimeout(() => {
      const { SYS, cutPoint, imgPoint } = this.data
      const { windowWidth, windowHeight } = SYS

      // 裁剪框居中
      const top = (windowHeight - cutPoint.height) / 2 - 30
      const left = (windowWidth - cutPoint.width) / 2

      // 图片同步位移
      imgPoint.top = imgPoint.top + (top - cutPoint.top)
      imgPoint.left = imgPoint.left + (left - cutPoint.left)

      Object.assign(cutPoint, { top, left })

      this.setData({
        cutPoint,
        cutStyle: this.getStyle(cutPoint, 'cut', ['--cut-transition-duration:0.4s']),
        imgPoint,
        imgStyle: this.getStyle(imgPoint, 'img', ['--img-transition-duration:0.4s'])
      })
      setTimeout(() => this.setData({ maskStyle: '--mask-opacity:0.8' }), 1000)
    }, 500)
  },

  // 旋转
  rotate() {
    const { limit, cutPoint, imgPoint, imgTimer } = this.data

    if (!imgPoint.width) return

    imgTimer && clearTimeout(imgTimer)

    imgPoint.rotate += 90

    limit.move.value && this.fill(cutPoint, imgPoint)

    this.setData({
      maskStyle: '--mask-opacity:0.5',
      imgPoint,
      imgStyle: this.getStyle(imgPoint, 'img', ['--img-transition-duration:0.4s']),
      imgTimer: setTimeout(() => {
        delete this.data.imgTimer

        if (imgPoint.rotate >= 360) {
          imgPoint.rotate = imgPoint.rotate % 360
          this.setData({
            imgPoint,
            imgStyle: this.getStyle(imgPoint, 'img')
          })
        }
      }, 2000)
    })
    setTimeout(() => this.setData({ maskStyle: '--mask-opacity:0.8' }), 1000)
  },

  // 放大/缩小
  zoom({ currentTarget }: WechatMiniprogram.CustomEvent) {
    const { options, limit, cutPoint, imgPoint, imgTimer } = this.data
    const { step } = currentTarget.dataset

    if (!imgPoint.width) return

    imgTimer && clearTimeout(imgTimer)

    imgPoint.scale = Math.min(
      Math.max(imgPoint.scale + Number(step), limit.move.value ? 1 : options.minScale),
      options.maxScale
    )

    limit.move.value && this.fill(cutPoint, imgPoint)

    this.setData({
      maskStyle: '--mask-opacity:0.5',
      imgPoint,
      imgStyle: this.getStyle(imgPoint, 'img', ['--img-transition-duration:0.4s']),
      imgTimer: setTimeout(() => delete this.data.imgTimer, 2000)
    })
    setTimeout(() => this.setData({ maskStyle: '--mask-opacity:0.8' }), 1000)
  },

  // 绘制图片
  draw({ currentTarget, touches: [touche] }: WechatMiniprogram.TouchEvent) {
    const { SYS, limit, cutPoint, imgPoint, imgSrc } = this.data
    const { target } = currentTarget.dataset

    if (!imgPoint.width) return

    // 判断点击坐标是否在剪裁框内
    if (
      target === 'preview' &&
      (touche.clientY < cutPoint.top ||
        touche.clientX > cutPoint.left + cutPoint.width ||
        touche.clientY > cutPoint.top + cutPoint.height ||
        touche.clientX < cutPoint.left)
    )
      return

    this.createSelectorQuery()
      .select('#canvas')
      .fields({ node: true, size: true })
      .exec(([{ node: canvas, width, height }]) => {
        const ctx = canvas.getContext('2d')
        const dpr = SYS.pixelRatio

        canvas.width = width * dpr
        canvas.height = height * dpr

        const img = canvas.createImage()
        img.src = imgSrc
        img.crossOrigin = 'Anonymous'
        img.onload = () => {
          const X = (imgPoint.left - cutPoint.left) * dpr
          const Y = (imgPoint.top - cutPoint.top) * dpr
          const width = imgPoint.width * dpr
          const height = imgPoint.height * dpr
          const top = height / 2
          const left = width / 2

          ctx.translate(X + left, Y + top)
          ctx.scale(imgPoint.scale * (limit.mirror.value ? -1 : 1), imgPoint.scale)
          ctx.rotate((imgPoint.rotate * Math.PI) / 180)
          ctx.drawImage(img, -left, -top, width, height)

          // 预览图片
          target === 'preview' &&
            wx.previewMedia({
              sources: [{ url: canvas.toDataURL('image/png') }]
            })

          // 生成图片
          target === 'render' &&
            wx.canvasToTempFilePath({
              width,
              height,
              destWidth: width,
              destHeight: height,
              canvas,
              success: ({ tempFilePath }) => wx.saveImageToPhotosAlbum({ filePath: tempFilePath })
            })
        }
      })
  },

  // 渲染图片
  render() {},

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad() {
    this.init()
  },

  /**
   * 生命周期函数--监听页面初次渲染完成
   */
  onReady() {},

  /**
   * 生命周期函数--监听页面显示
   */
  onShow() {},

  /**
   * 生命周期函数--监听页面隐藏
   */
  onHide() {},

  /**
   * 生命周期函数--监听页面卸载
   */
  onUnload() {},

  /**
   * 页面相关事件处理函数--监听用户下拉动作
   */
  onPullDownRefresh() {},

  /**
   * 页面上拉触底事件的处理函数
   */
  onReachBottom() {},

  /**
   * 用户点击右上角分享
   */
  onShareAppMessage() {}
})
